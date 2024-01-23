import { SVD } from 'svd-js';
import { transposeMatrix } from '../helpers';
import T from '../true_three';


/**
 * This class stores data for a plane and can be updated easily
 * Can also visually represent the plane.
 */
export class Plane {
    protected _point:T.Vector3;
    protected _normal:T.Vector3;
    protected _changeListeners: ((thisPlane:Plane) => void)[];

    protected _planeGroup:T.Group;
    protected _planeMeshMat:T.MeshStandardMaterial;

    constructor(point:T.Vector3, normal:T.Vector3, color:string="red") {
        // data to store shold be a Vector3 for the point and Vector3 for the normal
        this._point = point
        this._normal = normal
        this._changeListeners = [];

        // plane visual group
        this._planeGroup = new T.Group()
        let centerBall = new T.Mesh(
            new T.SphereGeometry(0.02),
            new T.MeshStandardMaterial({color: "white"})
        )

        this._planeMeshMat = new T.MeshStandardMaterial({
                color: color,
                side: T.DoubleSide,
                transparent: true,
                opacity: 0.2
            })
        
        const mesh = new T.Mesh(
            new T.PlaneGeometry(1, 1),
            this._planeMeshMat
        );

        this._planeGroup.add(centerBall)
        this._planeGroup.add(mesh)

        this._planeGroup.position.set(point.x, point.y, point.z)
        this._planeGroup.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z)

        this._planeGroup.visible = false
    }

    /**
     * Method that fires all the change listener functions for this Plane.
     */
    planeChanged() {
        this._changeListeners.forEach((func) => {
            func(this);
        });
    }

    /**
     * Returns the current color of this Plane.
     * @returns The color of the Plane.
     */
    color():T.Color {
        return this._planeMeshMat.color;
    }

    /**
     * Sets the Plane to be this color.
     * @param newColor The new color of this Plane.
     */
    setColor(newColor:T.Color) {
        this._planeMeshMat.color = newColor;
        this.planeChanged();
    }

    /**
     * Adds this Plane to the given Three Scene.
     * @param scene The scene to add this Plane to.
     */
    addToScene(scene:T.Scene) {
        scene.add(this._planeGroup);
    }

    /**
     * Removes this Plane from the given Three Scene.
     * @param scene The scene to remove this Plane from.
     */
    removeFromScene(scene:T.Scene) {
        scene.remove(this._planeGroup);
    }

    /**
     * Adds a listener function that will be called whenever this Plane is
     * changed in some way.
     * @param onChangeFunc The function to call whenever the Plane is changed.
     */
    addChangeListener(onChangeFunc:(thisPlane:Plane) => void) {
        this._changeListeners.push(onChangeFunc);
    }

    /**
     * Removes a listener function.
     * @param onChangeFunc The listener function to remove.
     */
    removeChangeListener(onChangeFunc:(thisPlane:Plane) => void) {
        const i = this._changeListeners.indexOf(onChangeFunc);
        if (i >= 0) {
            this._changeListeners.splice(i, 1);
        }
    }

    /**
     * Updates this Plane to be at the given point with the given normal.
     * @param point The new point that this Plane is at.
     * @param normal The new normal of this Plane.
     */
    updatePlane(point:T.Vector3, normal:T.Vector3, color?:T.Color) {
        this._point.copy(point)
        this._normal.copy(normal)
        this._planeGroup.position.set(point.x, point.y, point.z)
        this._planeGroup.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z)
        if (color) {
            this.setColor(color);
        }
        this.planeChanged();
    }

    /**
     * Sets whether this Plane should be visible from now on.
     * @param show True if this Plane should be visible from now on and False otherwise.
     */
    setVisible(show:boolean) {
        this._planeGroup.visible = show
    }

    /**
     * Returns the best Plane through the given points.
     * @param points The points to put the Plane through.
     * @returns The best Plane through the given points.
     */
    static getBestPlane(points:T.Vector3[]):Plane {
        let matrix = []
        let averagePoint = new T.Vector3(0, 0, 0)

        // get center of points
        for(let i = 0; i < points.length; i+=1) {
            averagePoint.add(points[i])
            matrix.push([points[i].x, points[i].y, points[i].z])
        }
        averagePoint.divideScalar(matrix.length)

        // normalize points
        for(let i = 0; i < matrix.length; i++) {
            matrix[i][0] -= averagePoint.x;
            matrix[i][1] -= averagePoint.y;
            matrix[i][2] -= averagePoint.z;
        }
        
        // perform svd
        let { u, v, q } = SVD(matrix, 'f')

        // get direction with smallest q value
        let index = 0;
        let min = 1000
        for(let i = 0; i < 3; i++) {
            if(q[i] < min) {
                min = q[i]
                index = i
            }
        }

        // get normal of plane
        let n = transposeMatrix(v)[index]
        let normal = new T.Vector3(n[0], n[1], n[2])
        return new Plane(averagePoint, normal);
    }
}