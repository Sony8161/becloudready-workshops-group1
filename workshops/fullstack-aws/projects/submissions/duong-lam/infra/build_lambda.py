"""Builds infra/build/lambda.zip for AWS Lambda: our backend .py files + the packages they need.

Lambda runs LINUX. Some packages (bcrypt, pydantic-core) contain compiled code, so pip is told to
download the Linux versions (--platform), even when you run this on Windows.

Usage (from the project root):   python infra/build_lambda.py
"""
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

INFRA = Path(__file__).resolve().parent
BACKEND = INFRA.parent / "backend"
BUILD = INFRA / "build"
PACKAGE = BUILD / "package"
ZIP_PATH = BUILD / "lambda.zip"
SKIP = {"test_mongo.py", "seed_demo.py"}   # local-only scripts, not needed on Lambda


def main() -> None:
    shutil.rmtree(BUILD, ignore_errors=True)
    PACKAGE.mkdir(parents=True)

    print("Installing packages (Linux, Python 3.12)...")
    subprocess.run([
        sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
        "--requirement", str(BACKEND / "requirements.txt"),
        "--target", str(PACKAGE),
        "--implementation", "cp", "--python-version", "3.12", "--only-binary=:all:",
        "--platform", "manylinux2014_x86_64",
        "--platform", "manylinux_2_28_x86_64",
        "--platform", "manylinux_2_34_x86_64",   # Lambda's python3.12 runs Amazon Linux 2023 (glibc 2.34)
    ], check=True)

    for source in BACKEND.glob("*.py"):
        if source.name not in SKIP:
            shutil.copy2(source, PACKAGE / source.name)

    # Fixed timestamps: the same code gives the same zip, so Terraform only uploads when something changed
    count = 0
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(PACKAGE.rglob("*")):
            if not path.is_file() or "__pycache__" in path.parts:
                continue
            info = zipfile.ZipInfo(path.relative_to(PACKAGE).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16   # readable on Linux
            zf.writestr(info, path.read_bytes())
            count += 1

    print(f"Built {ZIP_PATH} ({ZIP_PATH.stat().st_size / 1_000_000:.1f} MB, {count} files)")


if __name__ == "__main__":
    main()
