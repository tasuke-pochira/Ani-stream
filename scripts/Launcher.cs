using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

[assembly: AssemblyTitle("AniStream")]
[assembly: AssemblyDescription("Portable Anime Streaming Desktop App")]
[assembly: AssemblyProduct("AniStream")]
[assembly: AssemblyCopyright("Copyright © 2026 Pochira Software")]

namespace AniStreamLauncher
{
    class Program
    {
        static void Main(string[] args)
        {
            string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string corePath = Path.Combine(exeDir, "AniStream.dat");

            if (!File.Exists(corePath))
            {
                Console.WriteLine("Fatal Error: AniStream core components not found.");
                Console.WriteLine("Expected path: " + corePath);
                Console.ReadLine();
                return;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = corePath,
                Arguments = string.Join(" ", args),
                UseShellExecute = false,
                CreateNoWindow = false, // SHOW the window
                WorkingDirectory = exeDir,
                RedirectStandardOutput = false, // Let it use our console
                RedirectStandardError = false
            };

            try
            {
                using (Process proc = Process.Start(startInfo))
                {
                    // Wait for the core to finish so the console window stays open
                    proc.WaitForExit();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Failed to launch AniStream: " + ex.Message);
                Console.ReadLine();
            }
        }
    }
}
