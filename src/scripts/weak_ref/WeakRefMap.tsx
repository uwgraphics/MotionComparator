

/**
 * A Simple Map class that uses weakreferences to objects for its values instead
 * of strong ones so that the object can be offloaded from memory at any time,
 * even if it is in the Map.
 */
export class WeakRefMap<KeyType, ValueType extends Object> {
    protected _map: Map<KeyType, WeakRef<ValueType>>;
    constructor() {
        this._map = new Map();
    }

    has(key:KeyType):boolean {
        return (this.get(key) !== undefined);
    }

    set(key:KeyType, value:ValueType):WeakRefMap<KeyType, ValueType> {
        this._map.set(key, new WeakRef(value));
        return this;
    }

    get(key:KeyType):undefined | ValueType {
        let v = this._map.get(key);
        if (v) {
            return v.deref();
        } else {
            this._map.delete(key);
        }
        return undefined;
    }

    delete(key:KeyType):boolean {
        return this._map.delete(key);
    }
}