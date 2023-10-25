import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { PhpLiteAdminProvider } from './phpLiteAdmin';

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(PhpLiteAdminProvider.register(context));

    context.subscriptions.push(
        vscode.commands.registerCommand('phpliteadmin50.open', open)
    );
    await vscode.commands.executeCommand("setContext", "phpliteadmin50:didActivateExtension", true);
}

function open(fileUri: vscode.Uri) {

    // Launch php server
    console.log("Launching php server");
    const proc = spawn('/opt/cs50/bin/phpliteadmin', [`${fileUri.path}`], {"env": process.env});

    proc.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
        console.log("Opening phpLiteAdmin window");
        const local_url = `http://127.0.0.1:8082`;
        vscode.env.openExternal(vscode.Uri.parse(local_url));
    });

    proc.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    proc.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
}
