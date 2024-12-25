class DB {
    stores = {};
    #keyPaths = [];
    #db;
    #idb = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

    constructor(stores = {}, dbName = 'idb', reset) {
        this.dbName = dbName;
        Object.entries(stores).forEach(s => {
            this.stores[s[0]] = s[0];
            this.#keyPaths.push({ store: s[0], path: s[1] });
        });
        if (reset) {
            this.#idb.deleteDatabase(this.dbName);
        }
    }

    #createStores(db) {
        this.#keyPaths.forEach(kp => {
            const options = {
                keyPath: kp.path,
            };
            if (!kp.path) {
                options['keyPath'] = 'id';
                options['autoIncrement'] = true;
            }
            db.createObjectStore(kp.store, options);
        });
    }

    async open() {
        this.#db = await new Promise(res => {
            const open = this.#idb.open(this.dbName, 1);
            open.onerror = () => {
                console.error('openDb:', open.errorCode);
                res(false);
            };
            open.onsuccess = () => res(open.result);
            open.onupgradeneeded = () => this.#createStores(open.result);
        });
    }

    async add(store, value) {
        if (!this.#db) {
            await this.open();
        }
        return new Promise(res => {
            const tx = this.#db.transaction(store, 'readwrite');
            tx.onerror = () => {
                console.error('add:', tx.errorCode || 'key already in use');
                res(false);
            };
            const req = tx.objectStore(store).add(value);
            req.onsuccess = () => res(req.result);
        });
    }

    async put(store, value) {
        if (!this.#db) {
            await this.open();
        }
        return new Promise(res => {
            const tx = this.#db.transaction(store, 'readwrite');
            tx.onerror = () => {
                console.error('put:', tx.errorCode);
                res(false);
            };
            const req = tx.objectStore(store).put(value);
            req.onsuccess = () => res(req.result);
        });
    }

    async get(store, key) {
        if (!this.#db) {
            await this.open();
        }
        return new Promise(res => {
            const tx = this.#db.transaction(store, 'readonly');
            tx.onerror = () => {
                console.error('get:', tx.errorCode);
                res(false);
            };
            const req = tx.objectStore(store).get(key);
            req.onsuccess = () => res(req.result);
        });
    }

    async getAll(store) {
        if (!this.#db) {
            await this.open();
        }
        return new Promise(res => {
            const tx = this.#db.transaction(store, 'readonly');
            tx.onerror = () => {
                console.error('getAll:', tx.errorCode);
                res(false);
            };
            const req = tx.objectStore(store).getAll();
            req.onsuccess = () => res(req.result);
        });
    }

    async count(store) {
        if (!this.#db) {
            await this.open();
        }
        return new Promise(res => {
            const tx = this.#db.transaction(store, 'readonly');
            tx.onerror = () => {
                console.error('get:', tx.errorCode);
                res(false);
            };
            const req = tx.objectStore(store).count();
            req.onsuccess = () => res(req.result);
        });
    }

    async delete(store, key) {
        if (!this.#db) {
            await this.open();
        }
        return new Promise(res => {
            const tx = this.#db.transaction(store, 'readwrite');
            tx.onerror = () => {
                console.error('delete:', tx.errorCode);
                res(false);
            };
            tx.oncomplete = () => res(true);
            tx.objectStore(store).delete(key);
        });
    }
}
