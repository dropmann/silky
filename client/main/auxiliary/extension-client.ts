export function createAuxExtensionClientScript(): string {
    return `
        (() => {
            if (window.jamoviAux)
                return;

            let nextId = 1;
            const pending = new Map();
            const handlers = new Map();

            function send(type, payload) {
                const id = nextId++;
                parent.postMessage({ jamoviAux: true, type, id, ...payload }, '*');
                return new Promise((resolve, reject) => {
                    pending.set(id, { resolve, reject });
                });
            }

            function postHeight() {
                const height = Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.offsetHeight
                );
                parent.postMessage({ jamoviAux: true, type: 'resize', id: 0, height }, '*');
            }

            window.addEventListener('message', event => {
                const message = event.data;
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
            });

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

            new ResizeObserver(postHeight).observe(document.body);
            window.addEventListener('load', postHeight);
        })();
    `;
}
