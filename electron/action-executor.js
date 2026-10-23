const { shell } = require('electron');
const fs = require('fs');
const { exec } = require('child_process');

const getSelectedPath = () => {
    return new Promise((resolve) => {
        const psScript = `
            $shell = New-Object -ComObject Shell.Application
            $windows = $shell.Windows()
            foreach ($w in $windows) {
                if ($w.Name -eq 'File Explorer' -or $w.Name -eq 'Windows Explorer') {
                    try {
                        $sel = $w.Document.SelectedItems()
                        if ($sel.Count -gt 0) {
                            Write-Output $sel.Item(0).Path
                            break
                        }
                    } catch {}
                }
            }
        `;
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

        exec(`powershell -NoProfile -EncodedCommand ${encoded}`, (err, stdout) => {
            if (err || !stdout.trim()) resolve(null);
            else resolve(stdout.trim());
        });
    });
};

async function executeAction(action, targetPath) {
    if (!targetPath || !fs.existsSync(targetPath)) {
        return `I can't find that file anymore.`;
    }

    const fileName = targetPath.split('\\').pop();

    try {
        if (action === 'open') {
            await shell.openPath(targetPath);
            return `Opening ${fileName} for you!`;
        }
        else if (action === 'delete') {
            await shell.trashItem(targetPath);
            return `Deleted ${fileName}. Poof!`;
        }
    } catch (err) {
        return `Error: I don't have permission to do that.`;
    }
}

// THIS LINE WAS MISSING AND CAUSED THE CRASH!
module.exports = { executeAction, getSelectedPath };