import * as vscode from 'vscode';
import { PhpLiteAdminProvider } from './phpLiteAdmin';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(PhpLiteAdminProvider.register(context));
}
