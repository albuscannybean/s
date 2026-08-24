using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed class LmnWindow : Form
{
    private readonly WebView2 webView;
    private readonly Label loading;

    public LmnWindow()
    {
        Text = "LMN Knowledge System V3";
        StartPosition = FormStartPosition.CenterScreen;
        Width = 1440;
        Height = 900;
        MinimumSize = new Size(960, 640);
        BackColor = Color.FromArgb(250, 249, 245);

        loading = new Label {
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Segoe UI", 12F),
            Text = "LMN V3 is opening its local-first workspace…"
        };
        webView = new WebView2 { Dock = DockStyle.Fill, Visible = false };
        Controls.Add(webView);
        Controls.Add(loading);
        Shown += async delegate { await InitializeWebView(); };
    }

    private async System.Threading.Tasks.Task InitializeWebView()
    {
        try
        {
            string dataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "LMN Knowledge System", "WebView2");
            Directory.CreateDirectory(dataFolder);
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, dataFolder);
            await webView.EnsureCoreWebView2Async(environment);
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.lmn.local",
                AppDomain.CurrentDomain.BaseDirectory,
                CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
            webView.CoreWebView2.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args) {
                args.Handled = true;
                if (Uri.IsWellFormedUriString(args.Uri, UriKind.Absolute)) Process.Start(args.Uri);
            };
            webView.Source = new Uri("https://app.lmn.local/apps/web/index.html");
            webView.Visible = true;
            loading.Visible = false;
            webView.Focus();
        }
        catch (WebView2RuntimeNotFoundException)
        {
            loading.Text = "Microsoft Edge WebView2 Runtime is required.\nInstall it, then reopen LMN V3.";
            MessageBox.Show(this,
                "LMN V3 requires Microsoft Edge WebView2 Runtime. It is normally included with current Windows installations.",
                "WebView2 Runtime required", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception error)
        {
            loading.Text = "LMN V3 could not start.\n" + error.Message;
            MessageBox.Show(this, error.ToString(), "LMN startup error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Length > 0 && args[0].Equals("/smoke-test", StringComparison.OrdinalIgnoreCase))
        {
            string entry = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "apps", "web", "index.html");
            string engine = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "packages", "structure-engine", "templates.js");
            if (!File.Exists(entry) || !File.Exists(engine)) Environment.Exit(2);
            try { CoreWebView2Environment.GetAvailableBrowserVersionString(); }
            catch { Environment.Exit(3); }
            Environment.Exit(0);
        }
        bool ownsMutex;
        using (var mutex = new Mutex(true, "Local\\LMN-Knowledge-System-V3", out ownsMutex))
        {
            if (!ownsMutex) return;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LmnWindow());
        }
    }
}
