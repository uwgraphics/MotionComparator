import { MaybeDestroyed } from "./MaybeDestroyed";



export class MaybeDestroyedMap<KeyT, ValueT> {
    protected _map: Map<KeyT, MaybeDestroyed<ValueT>>;

    constructor() {
        this._map = new Map();
    }

    contains(key: KeyT): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: KeyT) {
        this._map.delete(key);
    }

    set(key: KeyT, value: MaybeDestroyed<ValueT>) {
        this._map.set(key, value);
    }

    get(key: KeyT): ValueT | undefined {
        let value = this._map.get(key);
        if (value !== undefined) {
            let v = value.deref();

            if (v === undefined) {
                // delete entry with destroyed value
                this._map.delete(key);
                return undefined;
            } else {
                return v;
            }
        }
    }
}