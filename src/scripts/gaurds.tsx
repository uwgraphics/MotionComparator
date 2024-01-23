/**
 * A module for TypeScript type gaurds. Some seem silly but are here so that if there is some
 * kind of change to the typeing of things there is some hope that you can
 * change it here and not have to change it everywhere all over the code.
 */
import { ThreeScene } from './scene/ThreeScene';
import T from './true_three';

export function isMesh(obj:any): obj is T.Mesh {
    return (obj instanceof T.Mesh) || (obj && ("isMesh" in obj));
}

export function isMaterial(obj:any): obj is T.Material {
    return (obj instanceof T.Material) || (obj && ("isMaterial" in obj) && obj.isMaterial);
}

type COLORED_MATERIALS = T.MeshBasicMaterial | T.MeshStandardMaterial | T.MeshPhongMaterial;
export function isColoredMaterial(mat:any): mat is COLORED_MATERIALS {
    return (mat && ("type" in mat) && (
               mat.type === "MeshBasicMaterial"
            || mat.type === "MeshStandardMaterial"
            || mat.type === "MeshPhongMaterial"
        )
    );
}

export function isThreeScene(obj:any): obj is ThreeScene {
    return obj instanceof ThreeScene;
}

export function isAxesHelper(obj:any): obj is T.AxesHelper {
    return obj instanceof T.AxesHelper;
}

export function isLineSegments(obj:any): obj is T.LineSegments {
    return obj instanceof T.LineSegments;
}
