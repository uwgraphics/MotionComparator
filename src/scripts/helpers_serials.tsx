/**
 * A module full of interfaces and functions useful for serialization.
 * 
 * to___(o) functions take the given object `o` and create an object of the ___ interface.
 * 
 * from___(donor, ___Obj) functions take the given donor and assign each field in ___Obj
 *   to it only if the field in ___Obj is not undefined. The functions return the donor
 *   object for convenience.
 */

// ------------------
// Mainly used for xyz coordinates
export interface xyz {
    x?:number,
    y?:number,
    z?:number,
}

interface _xyz {x:number, y:number, z:number}
export function toXYZ(o:_xyz):xyz {
    return { x:o.x, y:o.y, z:o.z}
}

export function fromXYZ<T extends _xyz>(donor:T, xyzObj?:xyz):T {
    if (!xyzObj) return donor;
    if (xyzObj.x) donor.x = xyzObj.x;
    if (xyzObj.y) donor.y = xyzObj.y;
    if (xyzObj.z) donor.z = xyzObj.z;
    return donor;
}

// ------------------
// Used mainly for quaternion rotations because they can have a w
export interface quaternion {
    x?:number,
    y?:number,
    z?:number,
    w?:number,
}

interface _xyzw { x:number, y:number, z:number, w:number }
export function toXYZW(o:_xyzw):quaternion {
    return { x:o.x, y:o.y, z:o.z, w:o.w };
}

export function fromXYZW<T extends _xyzw>(donor:T, q?:quaternion):T {
    if (!q) return donor;
    if (q.x) donor.x = q.x;
    if (q.y) donor.y = q.y;
    if (q.z) donor.z = q.z;
    if (q.w) donor.w = q.w;
    return donor;
}

// ------------------
// Used mainly for Euler rotation
export interface xyzOrder {
    x?:number,
    y?:number,
    z?:number,
    order?: string,
}

interface _xyzOrder { x:number, y:number, z:number, order:string }
export function toXYZOrder(o:_xyzOrder):xyzOrder {
    return { x:o.x, y:o.y, z:o.z, order:o.order };
}

export function fromXYZOrder<T extends _xyzOrder>(donor:T, xyzOrderObj?:xyzOrder):T {
    if (!xyzOrderObj) return donor;
    if (xyzOrderObj.x) donor.x = xyzOrderObj.x;
    if (xyzOrderObj.y) donor.y = xyzOrderObj.y;
    if (xyzOrderObj.z) donor.z = xyzOrderObj.z;
    if (xyzOrderObj.order) donor.order = xyzOrderObj.order;
    return donor;
}