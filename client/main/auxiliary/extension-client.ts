export function createAuxExtensionClientScript(): string {
    return `
        (() => {
            if (window.jamoviAux)
                return;

            let nextId = 1;
            const pending = new Map();
            const handlers = new Map();

            // the host talks to this document over a private MessagePort it
            // provides once the document has loaded; messages sent before
            // then are queued
            let port = null;
            const queued = [];

            function post(message) {
                if (port !== null)
                    port.postMessage(message);
                else
                    queued.push(message);
            }

            function send(type, payload) {
                const id = nextId++;
                post({ jamoviAux: true, type, id, ...payload });
                return new Promise((resolve, reject) => {
                    pending.set(id, { resolve, reject });
                });
            }

            function postHeight() {
                if (! document.body)
                    return;
                const height = Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.offsetHeight
                );
                post({ jamoviAux: true, type: 'resize', id: 0, height });
            }

            window.addEventListener('message', event => {
                const message = event.data;
                if (port !== null || event.source !== parent || ! message || message.jamoviAux !== true || message.type !== 'port' || ! event.ports[0])
                    return;

                port = event.ports[0];
                port.onmessage = portEvent => handleMessage(portEvent.data);
                for (const queuedMessage of queued.splice(0))
                    port.postMessage(queuedMessage);
            });

            function handleMessage(message) {
                if (! message || message.jamoviAux !== true)
                    return;

                if (message.type === 'response') {
                    const request = pending.get(message.id);
                    if (! request)
                        return;
                    pending.delete(message.id);
                    if (message.error)
                        request.reject(message.error);
                    else
                        request.resolve(message.result);
                    return;
                }

                if (message.type === 'event') {
                    const callbacks = handlers.get(message.name) || [];
                    for (const callback of callbacks)
                        callback(message.data);
                }
            }

            window.jamoviAux = {
                async connect(options) {
                    await send('connect', { apiVersion: options.apiVersion });
                    return {
                        context: {
                            get: () => send('request', { method: 'context.get' }),
                        },
                        dataset: {
                            summary: () => send('request', { method: 'dataset.summary' }),
                        },
                        variables: {
                            list: () => send('request', { method: 'variables.list' }),
                            get: variable => send('request', { method: 'variables.get', params: variable }),
                            getSelected: () => send('request', { method: 'variables.getSelected' }),
                        },
                        analyses: {
                            list: () => send('request', { method: 'analyses.list' }),
                            getSelected: () => send('request', { method: 'analyses.getSelected' }),
                        },
                        ui: {
                            notify: params => send('request', { method: 'ui.notify', params }),
                        },
                        on(name, callback) {
                            const callbacks = handlers.get(name) || [];
                            callbacks.push(callback);
                            handlers.set(name, callbacks);
                        },
                    };
                },
                resize: postHeight,
            };

            // key events don't leave the frame, so Escape is passed to the
            // host to close the panel, unless the extension handled it
            window.addEventListener('keydown', event => {
                if (event.code === 'Escape' && ! event.defaultPrevented)
                    post({ jamoviAux: true, type: 'exit', id: 0 });
            });

            new ResizeObserver(postHeight).observe(document.body);
            window.addEventListener('load', postHeight);
        })();
    `;
}
