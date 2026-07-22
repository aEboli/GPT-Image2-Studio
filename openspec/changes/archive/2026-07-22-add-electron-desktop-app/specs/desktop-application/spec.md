## ADDED Requirements

### Requirement: Desktop application opens the existing workbench in an independent window
The system SHALL provide an Electron desktop entry that starts the existing local Studio service and displays the real workbench in a dedicated application window rather than opening the system browser.

#### Scenario: User launches the desktop application
- **WHEN** the user starts GPT-Image2-Studio from the installed application or desktop development command
- **THEN** the system starts the local Studio service and waits until it is listening
- **AND** the system displays the existing workbench in an application window with the GPT-Image2-Studio application identity
- **AND** the system does not open the default browser for the primary workbench

#### Scenario: Local service startup fails
- **WHEN** the desktop application cannot initialize or listen with the local Studio service
- **THEN** the system displays a human-readable startup error
- **AND** the system exits without leaving an empty desktop window or background service

### Requirement: Desktop application owns the local service lifecycle
The desktop application SHALL bind its Studio service only to a loopback address on an operating-system-assigned available port and SHALL close that service when the application exits.

#### Scenario: Fixed development port is already occupied
- **WHEN** another process is already listening on the conventional Studio port and the desktop application starts
- **THEN** the desktop service receives another available loopback port from the operating system
- **AND** the desktop window loads the service instance created by that application process

#### Scenario: User exits the desktop application
- **WHEN** the final desktop window closes or the user quits the application
- **THEN** the application closes the local HTTP service and its active connections
- **AND** no detached Studio service from that application remains listening

#### Scenario: User starts the existing Node service
- **WHEN** the user runs `node server.mjs` or `npm start`
- **THEN** the existing browser-compatible local service still starts automatically
- **AND** its API, static asset, output, and configuration behavior remains compatible

### Requirement: Desktop renderer uses a minimum-privilege security boundary
The desktop application SHALL render the workbench with Node.js integration disabled, context isolation and Chromium sandboxing enabled, and no general-purpose Electron or IPC API exposed to page scripts.

#### Scenario: Workbench renderer starts
- **WHEN** the desktop BrowserWindow creates its renderer
- **THEN** page scripts cannot access Node.js or Electron modules
- **AND** context isolation, sandboxing, and normal web security remain enabled

#### Scenario: Page requests another window or external navigation
- **WHEN** workbench content requests a new window or navigation outside the exact local Studio origin
- **THEN** the desktop window refuses that navigation or new window
- **AND** only an explicitly allowed HTTPS destination can be handed to the system browser
- **AND** file, command, custom, and unapproved URL schemes are not opened

### Requirement: Desktop application runs as a single instance
The desktop application SHALL keep at most one primary application instance for the current user and SHALL reuse its existing window when launched again.

#### Scenario: User launches the application a second time
- **WHEN** a primary GPT-Image2-Studio desktop instance is already running and the user launches it again
- **THEN** the second process exits without starting another local Studio service
- **AND** the existing window is restored if minimized, shown, and focused

### Requirement: Desktop application preserves private local data across updates
The desktop application SHALL store Electron session data and Studio private configuration in a stable user-writable application data directory, while generated output continues to use the existing output directory contract.

#### Scenario: User saves API configuration and restarts
- **WHEN** the user saves API configuration in the desktop workbench, closes the application, and starts it again
- **THEN** the service reads the configuration from the same user application data directory
- **AND** an application update does not replace that private configuration with packaged files

#### Scenario: User generates or opens output
- **WHEN** the desktop user generates an image or invokes the existing open-output action
- **THEN** the system uses the same Pictures-based or environment-overridden output root as the existing local service
- **AND** the action operates on the user's real local output directory

### Requirement: Windows users receive a standard installable desktop package
The build SHALL produce a versioned Windows x64 NSIS installer containing the desktop shell, existing local service, workbench assets, production dependencies, and application icon without including private local data or development artifacts.

#### Scenario: Maintainer builds the desktop installer
- **WHEN** the maintainer runs the documented desktop build command on Windows with dependencies installed
- **THEN** the build creates a versioned `.exe` installer under the ignored desktop artifact directory
- **AND** the installer supports per-user installation, desktop and Start menu shortcuts, and standard uninstall

#### Scenario: User starts the installed program
- **WHEN** the user completes installation and launches the installed shortcut
- **THEN** Windows displays the configured application name and icon
- **AND** the program starts without requiring a separate Node.js installation or browser tab

#### Scenario: Maintainer inspects packaged content
- **WHEN** the packaged application files are listed
- **THEN** they include only the desktop runtime and required Studio source, assets, production modules, and user documentation
- **AND** they exclude `.env`, `.local`, generated output, tests, logs, screenshots, source-control metadata, and prior build artifacts

### Requirement: Existing distribution modes remain available
The desktop packaging change SHALL NOT remove or silently redirect the existing Node.js, browser launcher, cloud deployment, CLI generation, or IExpress installer entry points.

#### Scenario: Existing mode is built or launched after desktop support is added
- **WHEN** a maintainer uses an existing documented start, test, cloud build, CLI generation, or legacy installer command
- **THEN** that command retains its prior purpose and output contract
- **AND** desktop-only dependencies and behavior do not execute in the browser renderer or cloud worker

#### Scenario: Maintainer builds the legacy browser installer after adding Electron
- **WHEN** the legacy IExpress installer stages its application payload
- **THEN** it installs the lockfile's production dependencies in the isolated staging directory
- **AND** it does not copy Electron or desktop build tooling from the repository `node_modules`
