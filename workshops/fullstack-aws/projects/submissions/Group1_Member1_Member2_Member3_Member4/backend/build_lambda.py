"""Build backend/_build/lambda.zip for AWS Lambda (Python 3.12, x86_64).

Run from backend/:   python build_lambda.py
Works on Windows too: pip downloads Linux wheels (--platform), so bcrypt and pydantic-core
match the Lambda runtime instead of your PC. Upload the zip in the Lambda console
(Code > Upload from > .zip file) and set the handler to lambda_handler.handler.
"""
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).parent
BUILD = HERE / "_build"
PKG = BUILD / "package"
ZIP = BUILD / "lambda.zip"
APP_DIRS = ["controllers", "services", "repositories"]
APP_FILES = ["main.py", "lambda_handler.py", "config.py", "db.py", "dependencies.py", "auth_guard.py",
             "security.py", "serializers.py", "models.py", "errors.py", "seed_demo.py"]


def main() -> None:
    shutil.rmtree(BUILD, ignore_errors=True)
    PKG.mkdir(parents=True)
    subprocess.check_call([
        sys.executable, "-m", "pip", "install", "-r", str(HERE / "requirements-lambda.txt"), "-t", str(PKG),
        "--platform", "manylinux2014_x86_64", "--implementation", "cp", "--python-version", "3.12",
        "--only-binary=:all:", "--upgrade", "--quiet",
    ])
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for path in PKG.rglob("*"):
            if "__pycache__" in path.parts or path.suffix == ".pyc":
                continue
            z.write(path, path.relative_to(PKG))
        for name in APP_FILES:
            z.write(HERE / name, name)
        for d in APP_DIRS:
            for path in (HERE / d).rglob("*.py"):
                z.write(path, path.relative_to(HERE))
    print(f"Built {ZIP} ({ZIP.stat().st_size / 1_048_576:.1f} MB)")


if __name__ == "__main__":
    main()
