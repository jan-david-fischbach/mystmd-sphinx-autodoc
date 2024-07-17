import sys
import os

sys.path.insert(0, os.getcwd())
extensions = [
    "sphinx_ext_mystmd"
]
exclude_patterns = [".*", "_build"]
