import * as vscode from 'vscode';
import { Disposable, disposeAll } from './dispose';

class SQLiteDocument extends Disposable implements vscode.CustomDocument {

	static async create(
		uri: vscode.Uri,
		backupId: string | undefined
	): Promise<SQLiteDocument | PromiseLike<SQLiteDocument>> {
		return new SQLiteDocument(uri);
	}

	private readonly _uri: vscode.Uri;

	private constructor(
		uri: vscode.Uri
	) {
		super();
		this._uri = uri;
	}

	public get uri() { return this._uri; }

	private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	/**
	 * Fired when the document is disposed of.
	 */
	public readonly onDidDispose = this._onDidDispose.event;
}

export class PhpLiteAdminProvider implements vscode.CustomEditorProvider<SQLiteDocument> {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {

		return vscode.window.registerCustomEditorProvider(
			PhpLiteAdminProvider.viewType,
			new PhpLiteAdminProvider(context),
			{
				// For this demo extension, we enable `retainContextWhenHidden` which keeps the
				// webview alive even when it is not visible. You should avoid using this setting
				// unless is absolutely required as it does have memory overhead.
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			});
	}

	private static readonly viewType = 'cs50.phpliteadmin';

	/**
	 * Tracks all known webviews
	 */
	private readonly webviews = new WebviewCollection();

	constructor(
		private readonly _context: vscode.ExtensionContext
	) { }

	async openCustomDocument(
		uri: vscode.Uri,
		openContext: { backupId?: string },
		_token: vscode.CancellationToken
	): Promise<SQLiteDocument> {
		const document: SQLiteDocument = await SQLiteDocument.create(uri, openContext.backupId);
		return document;
	}

	async resolveCustomEditor(
		document: SQLiteDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		
		// Create new terminal and start php server
		const terminal = vscode.window.createTerminal("phpLiteAdmin");
		terminal.sendText(`phpliteadmin ${document.uri.path}`);

		// Add the webview to our internal set of active webviews
		this.webviews.add(document.uri, webviewPanel, terminal);

		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};

		// Construct preview url
		const preview_url = `https://${process.env.CODESPACE_NAME}-8082.githubpreview.dev/`;

		// Check to see if it is the first time launching web preview
		let authorize = false;
		const didLaunchPhpLiteAdmin = this._context.environmentVariableCollection.get("CS50_DID_START_PHPLITEADMIN");
		if (didLaunchPhpLiteAdmin == undefined) {
			authorize = true;
			this._context.environmentVariableCollection.replace("CS50_DID_START_PHPLITEADMIN", String(Date.now()));
		} else if (Date.now() - parseInt(didLaunchPhpLiteAdmin.value) > 86400) {
			authorize = true;
			this._context.environmentVariableCollection.replace("CS50_DID_START_PHPLITEADMIN", String(Date.now()));
		}

		// Load webview
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, preview_url, authorize);
	}

	private getHtmlForWebview(webview: vscode.Webview, preview_url: string, firstTimeLaunch: boolean): string {
		if (firstTimeLaunch) {
			
			return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>phpLiteAdmin</title>
			</head>
			<body style="background-color: #ffffff;">
			<div id=phpliteadmin></div>
			<h3 style="color: #000000;">Please visit the following link to authorize GitHub Preview:</h3>
			<h3 style="color: #000000;"><a href="${preview_url}">${preview_url}</a></h3>
			</body>
			</html>`;
		}
		
		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>phpLiteAdmin</title>
			</head>
			<body style="background-color: #ffffff;">
			<div>
				<div id=phpliteadmin>
					<h4 style="color: #000000;">Loading phpLiteAdmin in webview...</h4>
				</div>
					<h4 style="position: fixed;margin-left:10px; left: 0; bottom: 0; width: 100%; color: #000000; z-index:999999;">
					phpLiteAdmin running on: <a href="${preview_url}" style="text-decoration: none;">${preview_url}</a> <a href="${preview_url}" style="text-decoration: none;">(view in browser)</a>
				</h4>
			</div>
			</body>
			<script>
				setTimeout(() => {
					document.getElementById("phpliteadmin").innerHTML='<iframe src=${preview_url} style="position:fixed; top:0; left:0; bottom:0; right:0; width:100%; height:100%; border:none; margin:0; padding:0; overflow:hidden;"></iframe>'
				}, 3000)
			</script>
			</html>`;
	}

	private _requestId = 1;
	private readonly _callbacks = new Map<number, (response: any) => void>();

	private postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
		const requestId = this._requestId++;
		const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
		panel.webview.postMessage({ type, requestId, body });
		return p;
	}

	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<SQLiteDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	public saveCustomDocument(document: SQLiteDocument, cancellation: vscode.CancellationToken): Thenable<void> {
		return;
	}

	public saveCustomDocumentAs(document: SQLiteDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
		return;
	}

	public revertCustomDocument(document: SQLiteDocument, cancellation: vscode.CancellationToken): Thenable<void> {
		return;
	}

	public backupCustomDocument(document: SQLiteDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
		return;
	}
}


/**
 * Tracks all webviews.
 */
 class WebviewCollection {

	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Get all known webviews for a given uri.
	 */
	public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
		const key = uri.toString();
		for (const entry of this._webviews) {
			if (entry.resource === key) {
				yield entry.webviewPanel;
			}
		}
	}

	/**
	 * Add a new webview to the collection.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel, terminal:vscode.Terminal) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);
		webviewPanel.onDidDispose(() => {
			terminal.dispose();
		});
	}
}
