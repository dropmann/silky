'use strict';

import { EventEmitter } from 'tsee';

export const outdatedTimeout = 30000

export class Awareness extends EventEmitter {
    constructor(doc) {
        super();
        this.doc = doc;

        this.clientID = doc.clientID;

        this.states = new Map();

        this.meta = new Map();
        this._checkInterval = (setInterval(() => {
            const now = Date.now();
            if (this.getLocalState() !== null && (outdatedTimeout / 2 <= now - (this.meta.get(this.clientID)).lastUpdated)) {
                // renew local clock
                this.setLocalState(this.getLocalState());
            }

            const remove = [];
            this.meta.forEach((meta, clientid) => {
                if (clientid !== this.clientID && outdatedTimeout <= now - meta.lastUpdated && this.states.has(clientid))
                    remove.push(clientid);
            });
            if (remove.length > 0)
                removeAwarenessStates(this, remove, 'timeout');
        }, Math.floor(outdatedTimeout / 10)));
        doc.on('destroy', () => {
            this.destroy();
        });
        this.setLocalState({});
    }

    destroy() {
        this.emit('destroy', [this]);
        this.setLocalState(null);
        super.destroy();
        clearInterval(this._checkInterval);
    }

    getLocalState() {
        return this.states.get(this.clientID) || null;
    }

    setLocalState(state) {
        const clientID = this.clientID;
        const currLocalMeta = this.meta.get(clientID);
        const clock = currLocalMeta === undefined ? 0 : currLocalMeta.clock + 1;
        const prevState = this.states.get(clientID);
        if (state === null)
            this.states.delete(clientID);
        else
            this.states.set(clientID, state);

        this.meta.set(clientID, {
            clock,
            lastUpdated: Date.now()
        })
        const added = [];
        const updated = [];
        const filteredUpdated = [];
        const removed = [];
        if (state === null) {
            removed.push(clientID);
        } else if (prevState == null) {
            if (state != null)
                added.push(clientID);
        } else {
            updated.push(clientID);
            if ( ! this.isDeepEqual(prevState, state))
                filteredUpdated.push(clientID);
        }
        if (added.length > 0 || filteredUpdated.length > 0 || removed.length > 0) {
            this.emit('change', [{ added, updated: filteredUpdated, removed }, 'local']);
        }
        this.emit('update', [{ added, updated, removed }, 'local']);
    }

    setLocalStateField(field, value) {
        const state = this.getLocalState();
        if (state !== null) {
            this.setLocalState({
                ...state,
                [field]: value
            })
        }
    }

    getStates() {
        return this.states;
    }

    isDeepEqual(object1, object2) {

        const objKeys1 = Object.keys(object1);
        const objKeys2 = Object.keys(object2);

        if (objKeys1.length !== objKeys2.length) 
            return false;

        for (let key of objKeys1) {
            const value1 = object1[key];
            const value2 = object2[key];

            const isObjects = this.isObject(value1) && this.isObject(value2);

            if ((isObjects && !this.isDeepEqual(value1, value2)) ||
                (!isObjects && value1 !== value2)
            ) {
                return false;
            }
        }
        return true;
    }

    isObject(object) {
        return object != null && typeof object === "object";
    }

    removeAwarenessStates(clients, origin) {
        const removed = []
        for (let i = 0; i < clients.length; i++) {
            const clientID = clients[i]
            if (this.states.has(clientID)) {
                this.states.delete(clientID)
                if (clientID === this.clientID) {
                    const curMeta = this.meta.get(clientID);
                    this.meta.set(clientID, {
                        clock: curMeta.clock + 1,
                        lastUpdated: Date.now()
                    })
                }
                removed.push(clientID)
            }
        }
        if (removed.length > 0) {
            this.emit('change', [{ added: [], updated: [], removed }, origin])
            this.emit('update', [{ added: [], updated: [], removed }, origin])
        }
    }

    encodeAwarenessUpdate(instance, clients) {

        let coms = instance.attributes.coms;

        let awarenessPB = new coms.Messages.AwarenessRR();

        for (let clientId of clients) {
            let stateInfo = new coms.Messages.AwarenessRR.StateInfo();
            stateInfo.clientId = clientId;
            stateInfo.clock = this.meta.get(clientID).clock;
            stateInfo.state = JSON.stringify(this.states.get(clientID) || null);
            awarenessPB.states.push(stateInfo);
        }

        let request = new coms.Messages.ComsMessage();
        request.payload = awarenessPB.toArrayBuffer();
        request.payloadType = 'AwarenessRR';
        request.instanceId = instance.instanceId();

        return request;
    }

    applyAwarenessUpdate(instance, response, origin) {
        let coms = instance.attributes.coms;
        let awarenessPB = coms.Messages.AwarenessRR.decode(response.payload);
        const timestamp = Date.now();
        const added = []
        const updated = []
        const filteredUpdated = []
        const removed = []
        const len = awarenessPB.states.length
        for (let i = 0; i < len; i++) {
            let stateInfo = awarenessPB.states[i];
            const clientID = stateInfo.clientId;
            let clock = stateInfo.clock;
            const state = JSON.parse(stateInfo.state)
            const clientMeta = this.meta.get(clientID)
            const prevState = this.states.get(clientID)
            const currClock = clientMeta === undefined ? 0 : clientMeta.clock
            if (currClock < clock || (currClock === clock && state === null && this.states.has(clientID))) {
                if (state === null) {
                    // never let a remote client remove this local state
                    if (clientID === this.clientID && this.getLocalState() != null) {
                        // remote client removed the local state. Do not remote state. Broadcast a message indicating
                        // that this client still exists by increasing the clock
                        clock++
                    } else {
                        this.states.delete(clientID)
                    }
                } else {
                    this.states.set(clientID, state)
                }
                this.meta.set(clientID, {
                    clock,
                    lastUpdated: timestamp
                })
                if (clientMeta === undefined && state !== null) {
                    added.push(clientID)
                } else if (clientMeta !== undefined && state === null) {
                    removed.push(clientID)
                } else if (state !== null) {
                    if (!f.equalityDeep(state, prevState)) {
                        filteredUpdated.push(clientID)
                    }
                    updated.push(clientID)
                }
            }
        }
        if (added.length > 0 || filteredUpdated.length > 0 || removed.length > 0) {
            this.emit('change', [{
                added, updated: filteredUpdated, removed
            }, origin])
        }
        if (added.length > 0 || updated.length > 0 || removed.length > 0) {
            this.emit('update', [{
                added, updated, removed
            }, origin])
        }
    }
}