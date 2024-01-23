
/**
 * A wrapper around an array of weak references.
 */
export class WeakRefArray<T extends object> {
    protected _refs: WeakRef<T>[]

    constructor(init:T[]=[]) {
        this._refs = [];

        if (init) {
            for (const v of init) {
                this.push(v);
            }
        }
    }

    /**
     * Cleans the array so that all weak references to things that have been
     * deleted are romeved from the array.
     */
    clean() {
        let i = 0;
        while (i < this._refs.length) {
            let deref_value = this._refs[i].deref();
            if (deref_value === undefined) {
                this._refs.splice(i, 1);
                continue;
            }
            i += 1;
        }
    }

    push(value:T) {
        this._refs.push(new WeakRef(value));
    }

    remove(value:T) {
        let i = 0;
        while (i < this._refs.length) {
            let deref_value = this._refs[i].deref();
            if (deref_value === undefined) {
                this._refs.splice(i, 1);
                continue;
            }
            if (deref_value === value) {
                this._refs.splice(i, 1);
                break;
            }
            i += 1;
        }
    }

    get length():number {
        return Array.from(this).length;
    }

    * reverse():Generator<T, void, void> {
        let cache = Array.from(this);
        for (const v of cache.reverse()) {
            yield v;
        }
    }

    [Symbol.iterator]():Generator<T, void, void> {
        let t = this;
        function * inner():Generator<T, void, void> {
            let i = 0;
            while (i < t._refs.length) {
                let value:T | undefined = t._refs[i].deref();
                if (value !== undefined) {
                    yield value;
                    i += 1;       
                } else {
                    t._refs.splice(i, 1);
                }
            }
        }
        return inner();
    }
}