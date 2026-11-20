# Contributing to Better Slide

Thanks for your interest. Better Slide is an open source, local tool that adds a comment-based review loop and a coding agent on top of [Slidev](https://sli.dev).

> **Status:** the project is in its design phase. There is no code or test suite yet. The architecture and decisions are in [`aidd_docs/INSTALL.md`](aidd_docs/INSTALL.md). Before starting a large change, open an issue to discuss it.

## Ways to contribute

- Report a bug or suggest an idea through an [issue](../../issues/new/choose).
- Improve the documentation.
- Send a pull request (see below).

Found a security problem? Do not open a public issue. Follow [`SECURITY.md`](SECURITY.md).

## Pull request workflow

1. Fork the repository and create a branch from `main`.
2. Make your change. Keep it focused: one topic per pull request.
3. Add or update tests with your code, and run the test suite before opening the pull request (once the suite exists).
4. Open a pull request against `main` and fill in the template.

`main` is protected: nothing is pushed to it directly, every change goes through a pull request, and only maintainers can merge. For a first-time contributor, a maintainer has to approve the CI run before it starts. This is expected and not a sign your pull request was ignored.

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org), in the form `<type>(<scope>): description`.
- **Language:** code, comments, commits, issues and docs are in English.
- **Architecture:** keep the module boundaries described in [`aidd_docs/INSTALL.md`](aidd_docs/INSTALL.md). In particular, only the `agents` adapters know about the AI CLIs.

## Rules that are not negotiable

- Never read, copy, store or transmit the credentials or tokens of the AI CLIs (Claude Code, Codex). Better Slide only launches the CLI the user has already installed and logged in.
- Never commit a secret, token or personal data. Push protection is on, but check your diff anyway.

## Code of conduct

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
