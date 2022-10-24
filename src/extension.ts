import { exec } from 'child_process';
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
    exec(`/opt/cs50/bin/phpliteadmin ${fileUri.path}`, {"env": process.env}, () => {
        const local_url = `http://127.0.0.1:8082`;
        vscode.env.openExternal(vscode.Uri.parse(local_url));
    });
}
