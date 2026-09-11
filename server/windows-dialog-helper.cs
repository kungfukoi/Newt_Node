using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

internal sealed class WindowHandle : IWin32Window
{
    public WindowHandle(IntPtr handle) { Handle = handle; }
    public IntPtr Handle { get; private set; }
}

[ComImport]
[Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
internal class FileOpenDialogRcw { }

[ComImport]
[Guid("D57C7288-D4AD-4768-BE02-9D969532D960")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IFileOpenDialog
{
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint count, IntPtr filters);
    void SetFileTypeIndex(uint index);
    void GetFileTypeIndex(out uint index);
    void Advise(IntPtr events, out uint cookie);
    void Unadvise(uint cookie);
    void SetOptions(uint options);
    void GetOptions(out uint options);
    void SetDefaultFolder(IShellItem folder);
    void SetFolder(IShellItem folder);
    void GetFolder(out IShellItem folder);
    void GetCurrentSelection(out IShellItem item);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
    void GetResult(out IShellItem item);
    void AddPlace(IShellItem item, int alignment);
    void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
    void Close(int result);
    void SetClientGuid(ref Guid guid);
    void ClearClientData();
    void SetFilter(IntPtr filter);
    void GetResults(out IntPtr items);
    void GetSelectedItems(out IntPtr items);
}

[ComImport]
[Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IShellItem
{
    void BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, out IntPtr result);
    void GetParent(out IShellItem parent);
    void GetDisplayName(uint nameType, out IntPtr name);
    void GetAttributes(uint mask, out uint attributes);
    void Compare(IShellItem item, uint hint, out int order);
}

internal static class Program
{
    private const uint FosPickFolders = 0x20;
    private const uint FosForceFileSystem = 0x40;
    private const uint FosNoChangeDir = 0x08;
    private const uint FosPathMustExist = 0x800;
    private const uint SigdnFileSystemPath = 0x80058000;
    private const int ErrorCancelled = unchecked((int)0x800704C7);
    private const int SwRestore = 9;
    private const uint SwpNoSize = 0x0001;
    private const uint SwpNoMove = 0x0002;
    private const uint SwpShowWindow = 0x0040;
    private static readonly Guid ShellWindowsClsid = new Guid("9BA05972-F6A8-11CF-A442-00A0C90A8F39");

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr handle);

    [DllImport("user32.dll")]
    private static extern bool BringWindowToTop(IntPtr handle);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr handle, int command);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr handle, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);

    [DllImport("user32.dll")]
    private static extern bool AttachThreadInput(uint attachThreadId, uint attachToThreadId, bool attach);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
    private static extern int SHCreateItemFromParsingName(
        [MarshalAs(UnmanagedType.LPWStr)] string path,
        IntPtr context,
        ref Guid iid,
        [MarshalAs(UnmanagedType.Interface)] out IShellItem item);

    [DllImport("ole32.dll")]
    private static extern void CoTaskMemFree(IntPtr pointer);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr ShellExecute(IntPtr owner, string operation, string file, string parameters, string directory, int showCommand);

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length < 3) return 1;
        string mode = args[0] ?? "";
        string resultPath = args[1] ?? "";
        string title = args[2] ?? "NewtNode";
        string defaultPath = args.Length > 3 ? args[3] ?? "" : "";
        string defaultName = args.Length > 4 ? args[4] ?? "" : "";
        string extension = args.Length > 5 ? args[5] ?? "" : "";
        string filter = args.Length > 6 ? args[6] ?? "" : "";
        string errorPath = resultPath + ".error";

        try
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            IntPtr owner = GetForegroundWindow();

            string selectedPath;
            if (String.Equals(mode, "explore", StringComparison.OrdinalIgnoreCase))
                selectedPath = OpenFolder(defaultPath, owner);
            else if (String.Equals(mode, "folder", StringComparison.OrdinalIgnoreCase))
                selectedPath = SelectFolder(title, defaultPath, owner);
            else if (String.Equals(mode, "save", StringComparison.OrdinalIgnoreCase))
                selectedPath = SelectSaveFile(title, defaultPath, defaultName, extension, filter, owner);
            else
                selectedPath = SelectOpenFile(title, defaultPath, filter, owner);

            if (String.IsNullOrWhiteSpace(selectedPath)) return 2;
            File.WriteAllText(resultPath, selectedPath, new UTF8Encoding(false));
            return 0;
        }
        catch (Exception error)
        {
            try { File.WriteAllText(errorPath, error.ToString(), new UTF8Encoding(false)); } catch { }
            return 1;
        }
    }

    private static string SelectOpenFile(string title, string defaultPath, string filter, IntPtr owner)
    {
        using (OpenFileDialog dialog = new OpenFileDialog())
        {
            dialog.Title = title;
            dialog.Filter = String.IsNullOrWhiteSpace(filter) ? "All files (*.*)|*.*" : filter;
            dialog.CheckFileExists = true;
            dialog.Multiselect = false;
            dialog.RestoreDirectory = true;
            dialog.DereferenceLinks = true;
            ApplyInitialPath(dialog, defaultPath);
            DialogResult result = owner == IntPtr.Zero ? dialog.ShowDialog() : dialog.ShowDialog(new WindowHandle(owner));
            return result == DialogResult.OK ? dialog.FileName : null;
        }
    }

    private static string OpenFolder(string folderPath, IntPtr owner)
    {
        if (!Directory.Exists(folderPath)) throw new DirectoryNotFoundException("Folder is not accessible: " + folderPath);
        IntPtr result = ShellExecute(owner, "explore", folderPath, null, folderPath, 1);
        if (result.ToInt64() <= 32) throw new InvalidOperationException("Windows Explorer could not open that folder.");
        BringExplorerFolderToFront(folderPath);
        return folderPath;
    }

    private static void BringExplorerFolderToFront(string folderPath)
    {
        string targetPath = NormalizedFolderPath(folderPath);
        for (int attempt = 0; attempt < 30; attempt++)
        {
            IntPtr handle = ExplorerWindowHandleForPath(targetPath);
            if (handle != IntPtr.Zero)
            {
                ActivateWindow(handle);
                return;
            }
            Thread.Sleep(50);
        }
    }

    private static IntPtr ExplorerWindowHandleForPath(string targetPath)
    {
        Type shellWindowsType = Type.GetTypeFromCLSID(ShellWindowsClsid);
        if (shellWindowsType == null) return IntPtr.Zero;

        object shellWindows = null;
        try
        {
            shellWindows = Activator.CreateInstance(shellWindowsType);
            int count = Convert.ToInt32(GetComProperty(shellWindows, "Count"));
            for (int index = 0; index < count; index++)
            {
                object explorerWindow = null;
                object document = null;
                object folder = null;
                object self = null;
                try
                {
                    explorerWindow = InvokeComMethod(shellWindows, "Item", index);
                    document = GetComProperty(explorerWindow, "Document");
                    folder = GetComProperty(document, "Folder");
                    self = GetComProperty(folder, "Self");
                    string explorerPath = NormalizedFolderPath(Convert.ToString(GetComProperty(self, "Path")));
                    if (!String.Equals(targetPath, explorerPath, StringComparison.OrdinalIgnoreCase)) continue;
                    return new IntPtr(Convert.ToInt32(GetComProperty(explorerWindow, "HWND")));
                }
                catch
                {
                    // ShellWindows also includes non-Explorer windows. Ignore entries that do not expose a folder path.
                }
                finally
                {
                    ReleaseComObject(self);
                    ReleaseComObject(folder);
                    ReleaseComObject(document);
                    ReleaseComObject(explorerWindow);
                }
            }
        }
        finally
        {
            ReleaseComObject(shellWindows);
        }
        return IntPtr.Zero;
    }

    private static object GetComProperty(object target, string name)
    {
        return target.GetType().InvokeMember(name, BindingFlags.GetProperty, null, target, null);
    }

    private static object InvokeComMethod(object target, string name, params object[] arguments)
    {
        return target.GetType().InvokeMember(name, BindingFlags.InvokeMethod, null, target, arguments);
    }

    private static void ReleaseComObject(object value)
    {
        if (value != null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value);
    }

    private static string NormalizedFolderPath(string value)
    {
        if (String.IsNullOrWhiteSpace(value)) return "";
        try { return Path.GetFullPath(value).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
        catch { return value.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
    }

    private static void ActivateWindow(IntPtr handle)
    {
        uint currentThreadId = GetCurrentThreadId();
        IntPtr foregroundHandle = GetForegroundWindow();
        uint foregroundProcessId;
        uint foregroundThreadId = foregroundHandle == IntPtr.Zero ? 0 : GetWindowThreadProcessId(foregroundHandle, out foregroundProcessId);
        uint explorerProcessId;
        uint explorerThreadId = GetWindowThreadProcessId(handle, out explorerProcessId);
        bool attachedToForeground = foregroundThreadId != 0 && foregroundThreadId != currentThreadId && AttachThreadInput(currentThreadId, foregroundThreadId, true);
        bool attachedToExplorer = explorerThreadId != 0 && explorerThreadId != currentThreadId && explorerThreadId != foregroundThreadId && AttachThreadInput(currentThreadId, explorerThreadId, true);
        try
        {
            ShowWindow(handle, SwRestore);
            SetWindowPos(handle, IntPtr.Zero, 0, 0, 0, 0, SwpNoMove | SwpNoSize | SwpShowWindow);
            BringWindowToTop(handle);
            SetForegroundWindow(handle);
        }
        finally
        {
            if (attachedToExplorer) AttachThreadInput(currentThreadId, explorerThreadId, false);
            if (attachedToForeground) AttachThreadInput(currentThreadId, foregroundThreadId, false);
        }
    }

    private static string SelectSaveFile(string title, string defaultPath, string defaultName, string extension, string filter, IntPtr owner)
    {
        using (SaveFileDialog dialog = new SaveFileDialog())
        {
            dialog.Title = title;
            dialog.InitialDirectory = ExistingDirectory(defaultPath);
            dialog.FileName = defaultName;
            dialog.OverwritePrompt = true;
            dialog.AddExtension = !String.IsNullOrWhiteSpace(extension);
            dialog.DefaultExt = extension;
            dialog.Filter = String.IsNullOrWhiteSpace(filter) ? "All files (*.*)|*.*" : filter;
            DialogResult result = owner == IntPtr.Zero ? dialog.ShowDialog() : dialog.ShowDialog(new WindowHandle(owner));
            return result == DialogResult.OK ? dialog.FileName : null;
        }
    }

    private static string SelectFolder(string title, string defaultPath, IntPtr owner)
    {
        object dialogObject = new FileOpenDialogRcw();
        IFileOpenDialog dialog = (IFileOpenDialog)dialogObject;
        IShellItem initialFolder = null;
        IShellItem result = null;
        try
        {
            uint options;
            dialog.GetOptions(out options);
            dialog.SetOptions(options | FosPickFolders | FosForceFileSystem | FosNoChangeDir | FosPathMustExist);
            dialog.SetTitle(title);
            dialog.SetOkButtonLabel("Select Folder");
            string initialPath = ExistingDirectory(defaultPath);
            if (!String.IsNullOrWhiteSpace(initialPath))
            {
                Guid shellItemGuid = new Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE");
                if (SHCreateItemFromParsingName(initialPath, IntPtr.Zero, ref shellItemGuid, out initialFolder) == 0)
                    dialog.SetFolder(initialFolder);
            }

            int resultCode = dialog.Show(owner);
            if (resultCode == ErrorCancelled) return null;
            if (resultCode != 0) Marshal.ThrowExceptionForHR(resultCode);
            dialog.GetResult(out result);
            IntPtr pathPointer;
            result.GetDisplayName(SigdnFileSystemPath, out pathPointer);
            try { return Marshal.PtrToStringUni(pathPointer); }
            finally { CoTaskMemFree(pathPointer); }
        }
        finally
        {
            if (result != null) Marshal.ReleaseComObject(result);
            if (initialFolder != null) Marshal.ReleaseComObject(initialFolder);
            Marshal.ReleaseComObject(dialogObject);
        }
    }

    private static void ApplyInitialPath(FileDialog dialog, string selectedPath)
    {
        if (String.IsNullOrWhiteSpace(selectedPath)) return;
        if (File.Exists(selectedPath))
        {
            dialog.InitialDirectory = Path.GetDirectoryName(selectedPath);
            dialog.FileName = Path.GetFileName(selectedPath);
        }
        else if (Directory.Exists(selectedPath))
        {
            dialog.InitialDirectory = selectedPath;
        }
    }

    private static string ExistingDirectory(string selectedPath)
    {
        if (Directory.Exists(selectedPath)) return selectedPath;
        if (File.Exists(selectedPath)) return Path.GetDirectoryName(selectedPath);
        return "";
    }
}
