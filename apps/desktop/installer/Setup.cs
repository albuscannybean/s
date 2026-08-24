using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Setup
{
    private const string AppName = "LMN Knowledge System V3";
    private static readonly string InstallDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "LMN Knowledge System");
    private static readonly string StartShortcut = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", "LMN Knowledge System V3.lnk");
    private static readonly string DesktopShortcut = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "LMN Knowledge System V3.lnk");

    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Length > 0 && args[0].Equals("/uninstall", StringComparison.OrdinalIgnoreCase)) { Uninstall(); return; }
        DialogResult answer = MessageBox.Show(
            "Install LMN Knowledge System V3 for this Windows user?\n\nLocation:\n" + InstallDirectory,
            AppName + " Setup", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (answer != DialogResult.Yes) return;
        try { Install(); MessageBox.Show("LMN V3 was installed successfully.", AppName, MessageBoxButtons.OK, MessageBoxIcon.Information); Process.Start(Path.Combine(InstallDirectory, "LMN.exe")); }
        catch (Exception error) { MessageBox.Show(error.ToString(), "Installation failed", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    private static void Install()
    {
        Directory.CreateDirectory(InstallDirectory);
        string temporary = Path.Combine(Path.GetTempPath(), "lmn-v3-setup-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temporary);
        try
        {
            using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("LMN.Payload.zip"))
            {
                if (stream == null) throw new InvalidOperationException("Installer payload is missing.");
                string archive = Path.Combine(temporary, "payload.zip");
                using (FileStream target = File.Create(archive)) stream.CopyTo(target);
                ZipFile.ExtractToDirectory(archive, Path.Combine(temporary, "payload"));
            }
            CopyDirectory(Path.Combine(temporary, "payload"), InstallDirectory);
            File.Copy(Application.ExecutablePath, Path.Combine(InstallDirectory, "Uninstall.exe"), true);
            CreateShortcut(StartShortcut, Path.Combine(InstallDirectory, "LMN.exe"));
            CreateShortcut(DesktopShortcut, Path.Combine(InstallDirectory, "LMN.exe"));
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\LMNKnowledgeSystemV3"))
            {
                key.SetValue("DisplayName", AppName); key.SetValue("DisplayVersion", "3.0.0"); key.SetValue("Publisher", "LMN Knowledge System");
                key.SetValue("InstallLocation", InstallDirectory); key.SetValue("DisplayIcon", Path.Combine(InstallDirectory, "LMN.exe"));
                key.SetValue("UninstallString", "\"" + Path.Combine(InstallDirectory, "Uninstall.exe") + "\" /uninstall");
                key.SetValue("NoModify", 1, RegistryValueKind.DWord); key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }
        finally { if (Directory.Exists(temporary)) Directory.Delete(temporary, true); }
    }

    private static void Uninstall()
    {
        if (MessageBox.Show("Remove LMN Knowledge System V3?\n\nYour browser workspace data is stored separately in the WebView2 profile.", AppName, MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        TryDelete(StartShortcut); TryDelete(DesktopShortcut); Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\LMNKnowledgeSystemV3", false);
        string command = "/C ping 127.0.0.1 -n 3 > nul & rmdir /S /Q \"" + InstallDirectory + "\"";
        Process.Start(new ProcessStartInfo("cmd.exe", command) { CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
    }

    private static void CopyDirectory(string source, string target)
    {
        Directory.CreateDirectory(target);
        foreach (string file in Directory.GetFiles(source)) File.Copy(file, Path.Combine(target, Path.GetFileName(file)), true);
        foreach (string directory in Directory.GetDirectories(source)) CopyDirectory(directory, Path.Combine(target, Path.GetFileName(directory)));
    }
    private static void CreateShortcut(string path, string target)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        Type type = Type.GetTypeFromProgID("WScript.Shell"); dynamic shell = Activator.CreateInstance(type); dynamic shortcut = shell.CreateShortcut(path);
        shortcut.TargetPath = target; shortcut.WorkingDirectory = InstallDirectory; shortcut.Description = AppName; shortcut.Save();
    }
    private static void TryDelete(string path) { if (File.Exists(path)) File.Delete(path); }
}
