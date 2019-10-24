This directory contains build and runtime artifacts. No content is tracked, but the directory structure is, to make it safe to assume a particular structure in code. 

To track a new directory, create it, create an empty `.keepdir` file with `touch .keepdir`, and check in the file.

To remove files, run `./clean [path]`. It will clean all untracked files under this directory and optionally restrict to just those files under `path`.
