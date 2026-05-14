#define AppName "AniStream"
#define AppVersion "1.0.0"
#define AppPublisher "pochira"
#define AppExeName "AniStream.exe"

[Setup]
AppId={{AniStream-Pochira-2026}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://www.instagram.com/3cstat1c.fl/
DefaultDirName={autopf}\{#AppName}
DisableDirPage=no
AlwaysShowDirOnReadyPage=yes
DefaultGroupName={#AppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE.txt
; Uncomment the following line to run in non-administrative install mode (install for current user only).
;PrivilegesRequired=lowest
OutputDir=installer_output
OutputBaseFilename=AniStream_Setup_v1.0.0
SetupIconFile=..\assets\fox_mask.ico
UninstallDisplayIcon={app}\{#AppExeName}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Dirs]
Name: "{app}"; Permissions: users-modify

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\AniStream.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\settings.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\vendor\*"; DestDir: "{app}\vendor"; Flags: ignoreversion recursesubdirs createallsubdirs
; NOTE: Don't use "Flags: ignoreversion" on any shared system files

[Icons]
Name: "{group}\AniStream"; Filename: "{app}\AniStream.exe"
Name: "{group}\{cm:UninstallProgram,AniStream}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\AniStream"; Filename: "{app}\AniStream.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\AniStream.exe"; Description: "{cm:LaunchProgram,AniStream}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: files; Name: "{app}\data\*"
Type: dirifempty; Name: "{app}\data"
