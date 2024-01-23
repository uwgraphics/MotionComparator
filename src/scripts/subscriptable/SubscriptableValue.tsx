import { SubscribeArray } from "./SubscribeArray";
import { SubscribeArrayWithArg } from "./SubscribeArrayWithArg";



export class SubscriptableValue<T> {
    protected _beforeSet: SubscribeArrayWithArg<[T, T]>;
    protected _value: T;
    protected _afterSet: SubscribeArrayWithArg<[T, T]>;

    /**
     * @param startValue The wrapped value to start out with.
     */
    constructor(startValue: T) {
        this._beforeSet = new SubscribeArrayWithArg();
        this._value = startValue;
        this._afterSet = new SubscribeArrayWithArg();
    }

    /**
     * @returns The value as it currently is.
     */
    value(): T {
        return this._value;
    }

    /**
     * @param newValue The new value of this value.
     */
    setValue(beforeSet: ((oldV:T, newV:T) => void) | null, newValue: T, afterSet: ((oldV: T, newV: T) => void) | null) {
        this._beforeSet.call([this._value, newValue]);
        if (beforeSet) { beforeSet(this._value, newValue); }
        this._value = newValue;
        if (afterSet) { afterSet(this._value, newValue); }
        this._afterSet.call([this._value, newValue]);
    }

    /**
     * @returns The subscriptable that is called before the wrapped value is
     * set.
     */
    beforeSet(): SubscribeArrayWithArg<[T, T]> {
        return this._beforeSet;
    }

    /**
     * @returns The subscriptable that is called after the wrapped value is set.
     */
    afterSet(): SubscribeArrayWithArg<[T, T]> {
        return this._afterSet;
    }
}