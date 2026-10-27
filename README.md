# NewtNode

Batch audition (`4.27.0-beta.0`): select image or video nodes and choose **Batch** from the selection bar or context menu. Drop files or connect sources, remove entries, and click an entry to edit its optional prompt. Each collection contains images or videos; its output connects to matching media inputs throughout the canvas. Runnable processors operate on each entry with shared settings, up to three at once within existing resource limits. Preview, Timeline and Composer expose collection items through their usual media controls. Completed media have a **Batch** output for further processing. A Text Agent can write a prompt per image/video; its Batch output carries each original source with its generated prompt. Results stay ordered, failures can be retried individually, and interrupted runs do not automatically resubmit. Multiple connected batches pair by position with equal lengths (a single entry broadcasts); Cross combinations are not included. The container has no move arrows, upload buttons or instructional footer; add files by dropping them onto it.

<p align="center">
  <img src="public/newtnode-logo.png" alt="NewtNode" width="520" />
</p>

**A node and canvas-based IDE for AI-assisted filmmaking, content creation, and media editing.**

NewtNode connects image, video, audio, text, and 3D tools on a node canvas. Build reusable creative pipelines, work with references, edit and preview results, and save projects with their media. The app runs locally in your browser on Windows and macOS.

## Features

- **Visual workflows:** Connect typed nodes, run dependent steps, and reuse groups of nodes as presets.
- **AI generation:** Use supported cloud providers for images, video, audio, text, and 3D assets, with explicit model and provider selection.
- **Creative planning:** Develop looks with Explore, build character references, and plan shots with Director and Storyboard.
- **Media editing:** Edit images, assemble video and audio on the Timeline, composite media, and use optional local processing tools.
- **Project management:** Save portable workflow packages, browse project outputs, and restore your workspace after reopening.
- **Usage tracking:** Review generation history, progress, and available cost estimates in Stats.

See the [feature and workflow guide](docs/features-and-workflows.md) for the full tool catalog and supported providers.

## Requirements

- Windows or macOS and a modern web browser.
- [Node.js](https://nodejs.org/) 22.12 or newer on the 22.x line, with npm.
- Internet access for installation and cloud model requests.
- API credentials for the providers you want to use. Cloud generation may incur provider charges.

FFmpeg and FFprobe are installed with the app. Optional local engines have additional requirements; see [dependencies](docs/dependencies.md) and [CorridorKey setup](docs/keyer.md).

## Quick start

### 1. Download

Clone the repository:

```bash
git clone https://github.com/kungfukoi/Newt_Node.git
cd Newt_Node
```

Alternatively, select **Code → Download ZIP** on GitHub and extract the archive.

### 2. Launch

**Windows:** Double-click `Launch_NewtNode.bat` in the project folder.

**macOS:** Open Terminal in the project folder and run:

```bash
chmod +x NewtNode.command
./NewtNode.command
```

The launcher installs required packages, builds the app, starts the local services, and opens your browser. The first launch can take a few minutes.

The default app address is **<http://127.0.0.1:5176>**.

### 3. Configure providers

Open **Settings → API Credentials**, add your provider keys, and save. Use **Model Providers** to choose which service handles supported models. Provider availability depends on your credentials and account access.

API keys and project files are stored locally. Cloud providers receive the inputs you submit to their models.

## Usage

1. Open **Nodes** and add media, reference, and model nodes from the palette.
2. Connect compatible ports, configure the model, and run the workflow.
3. Review results in the node, a Preview node, or the project output panel.
4. Save your workflow as a package to keep its inputs and outputs together. Use an Output node to export media.

Open **Settings → User Preferences** to adjust canvas navigation, hover video scrubbing, and other preferences. Repository updates are available in **Settings → Repository**.

## Documentation

- [Feature and workflow guide](docs/features-and-workflows.md)
- [Creative workflows: Director, Storyboard, and references](docs/creative-workflows.md)
- [Explore look development](docs/explore-node.md)
- [Reusable workflow presets](docs/newt-presets.md)
- [Generation recovery and troubleshooting](docs/remote-video-recovery.md)
- [Complete documentation index](docs/README.md)

## Development

```bash
npm ci
npm run dev
```

Open <http://127.0.0.1:5176>. On Windows, use `npm.cmd` if PowerShell blocks `npm`.

```bash
npm test          # Unit and regression tests
npm run build    # Production build
```

Read the [development guide](docs/development.md), [architecture](docs/architecture.md), and [contributor instructions](AGENTS.md) before making changes.

## Support and contributions

Report bugs and suggest features through [GitHub Issues](https://github.com/kungfukoi/Newt_Node/issues). Include reproduction steps, your operating system, and the app version for bug reports. Keep API keys out of reports and logs you share.

Pull requests are welcome. See the [development guide](docs/development.md) for validation requirements and project conventions.

## Third-party notices

See [Third-Party Notices](THIRD_PARTY_NOTICES.md) for acknowledgments and license information for third-party components. Optional engines and hosted services have their own terms; consult their setup guides before use.

Kling 4.0 Image-to-Video is available through the selected Fal or Atlas Cloud Video Model provider. See [settings, keyframes and provider limits](docs/kling4.md).
