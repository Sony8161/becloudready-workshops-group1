# The API server: one small EC2 instance running the API's Docker container.
# No SSH: port 22 is closed and there is no key pair. You get a shell with SSM Session Manager instead,
# and deploys run through SSM Run Command. Only CloudFront can reach port 80.

data "aws_caller_identity" "current" {}

# The default VPC every AWS account comes with (keeps this project simple)
data "aws_vpc" "default" {
  default = true
}

# Not every availability zone sells every instance size, so only use zones that have ours
data "aws_ec2_instance_type_offerings" "api" {
  location_type = "availability-zone"
  filter {
    name   = "instance-type"
    values = [var.instance_type]
  }
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
  filter {
    name   = "availability-zone"
    values = data.aws_ec2_instance_type_offerings.api.locations
  }
}

# Latest Amazon Linux 2023 image (AWS publishes its ID in a public SSM parameter)
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# AWS-managed list of the IP ranges CloudFront uses to reach origins
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# ---------- Firewall ----------
resource "aws_security_group" "api" {
  name        = "${var.project}-api"
  description = "API server: HTTP from CloudFront only, no SSH"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "http_from_cloudfront" {
  security_group_id = aws_security_group.api.id
  description       = "HTTP from CloudFront only"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "all_out" {
  security_group_id = aws_security_group.api.id
  description       = "Outbound: MongoDB Atlas, ECR, SSM, OS updates"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ---------- What the server itself is allowed to do (IAM role) ----------
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api_server" {
  name               = "${var.project}-api-server"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# Lets SSM manage the server: Session Manager shell + Run Command (how deploys reach it)
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.api_server.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Least privilege: only OUR image, OUR settings, OUR log group
data "aws_iam_policy_document" "api_server" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"] # this action has no resource-level permissions
  }
  statement {
    sid       = "PullApiImage"
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = [aws_ecr_repository.api.arn]
  }
  statement {
    sid     = "ReadAppSettings"
    actions = ["ssm:GetParametersByPath"]
    resources = [
      "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.param_path}",
      "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.param_path}/*",
    ]
  }
  statement {
    sid       = "WriteContainerLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }
}

resource "aws_iam_role_policy" "api_server" {
  name   = "${var.project}-api-server"
  role   = aws_iam_role.api_server.id
  policy = data.aws_iam_policy_document.api_server.json
}

resource "aws_iam_instance_profile" "api_server" {
  name = "${var.project}-api-server"
  role = aws_iam_role.api_server.name
}

# ---------- Logs ----------
# The container's output (uvicorn requests, errors, dev-mode emails) lands in CloudWatch Logs
resource "aws_cloudwatch_log_group" "api" {
  name              = "/${var.project}/api"
  retention_in_days = 14
}

# ---------- The server ----------
resource "aws_instance" "api" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = sort(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids = [aws_security_group.api.id]
  iam_instance_profile   = aws_iam_instance_profile.api_server.name

  # Runs once at first boot: installs Docker and writes /opt/simplebank/deploy.sh.
  # replace(): Linux needs LF line endings, even if Git on Windows checked the file out with CRLF.
  user_data = replace(templatefile("${path.module}/user_data.sh.tftpl", {
    region     = var.region
    registry   = split("/", aws_ecr_repository.api.repository_url)[0]
    image      = "${aws_ecr_repository.api.repository_url}:latest"
    param_path = local.param_path
    log_group  = aws_cloudwatch_log_group.api.name
  }), "\r\n", "\n")
  user_data_replace_on_change = true

  # IMDSv2 only: blocks the classic SSRF trick of stealing the server's AWS keys from the metadata URL
  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 16
    encrypted   = true
  }

  tags = {
    Name = "${var.project}-api"
  }

  lifecycle {
    ignore_changes = [ami] # a newer Amazon Linux image shouldn't rebuild the server on every apply
  }

  depends_on = [aws_ssm_parameter.secret, aws_iam_role_policy.api_server]
}

# A fixed public IP (and DNS name) for the server, kept even if it reboots.
# CloudFront uses its DNS name as the API origin; MongoDB Atlas must allow this IP.
resource "aws_eip" "api" {
  instance = aws_instance.api.id
  domain   = "vpc"

  tags = {
    Name = "${var.project}-api"
  }
}
