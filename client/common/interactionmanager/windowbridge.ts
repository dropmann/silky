export class WindowBridge {
    readonly isMainWindow: boolean;
    readonly mainWindow: Window;

    private setBlurring: (value: boolean) => void;
    private isolatedFrames = new Set<HTMLIFrameElement>();

    constructor(setBlurring: (value: boolean) => void) {
        this.setBlurring = setBlurring;
        this.isMainWindow = window.document.querySelector('body#main-window') !== null;
        this.mainWindow = this.isMainWindow ? window : window.parent;
    }

    transferFocus(otherWindow: Window | HTMLIFrameElement): void {
        this.setBlurring(true);
        otherWindow.focus();
        if (otherWindow !== this.mainWindow && otherWindow instanceof HTMLIFrameElement && otherWindow.contentWindow) {
            setTimeout(() => {
                otherWindow.contentWindow.focus();
            }, 100);
        }
    }

    /**
     * Excludes an iframe from the bridge. Its messages are ignored, and
     * broadcasts are not sent to it. Use for frames hosting untrusted content.
     */
    isolateFrame(iframe: HTMLIFrameElement): () => void {
        this.isolatedFrames.add(iframe);
        return () => {
            this.isolatedFrames.delete(iframe);
        };
    }

    isIsolatedSource(source: MessageEventSource | null): boolean {
        if (source === null)
            return false;

        for (const iframe of this.isolatedFrames) {
            if (iframe.contentWindow === source)
                return true;
        }
        return false;
    }

    invoke(invokeWindow: Window, id: string, args: any[], transferFocus: boolean): void {
        if (invokeWindow === window)
            throw new Error('Cannot invoke in the same window that was called from');

        if (transferFocus)
            this.transferFocus(invokeWindow);
        invokeWindow.postMessage({ id, args, type: 'focusLoop' }, '*');
    }

    broadcast(id: string, args: any[], transferFocus: boolean): void {
        const data = { id, args, type: 'focusLoop' };
        if (!this.isMainWindow && transferFocus)
            this.transferFocus(this.mainWindow);

        if (!this.isMainWindow)
            this.mainWindow.postMessage(data, '*');

        for (let i = 0; i < this.mainWindow.frames.length; i++) {
            const frame = this.mainWindow.frames[i];
            if (window !== frame && ! this.isIsolatedSource(frame))
                frame.postMessage(data, '*');
        }
    }
}
