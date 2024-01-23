import { AnimationManager } from '../AnimationManager';
import { LimitFunc } from '../LimitFunc';
import { APP, MAX_FRAMERATE } from '../constants';
import { WeakRefArray } from '../weak_ref/WeakRefArray';
import { SceneView } from './SceneView';
import T from '../true_three';
import { Robot } from '../objects3D/Robot';
import { Object3D } from 'three';

export interface serialized_three_scene {

}

// The browser only allows 8 WebGLRenderers to exist at any given time, so we
// will use 1 renderer to render every ThreeScene
const webgl_renderer = new T.WebGLRenderer({
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: true,
});
webgl_renderer.outputEncoding = T.sRGBEncoding;
webgl_renderer.shadowMap.enabled = true;
webgl_renderer.shadowMap.type = T.PCFSoftShadowMap;


const usedSceneNames = new Set<string>();
var numScenes:number = 0;


/**
 * Object to encapsulate rendering a scene. Since creating and destroying a
 * Three Scene is very expensive, the App will instead keep a copy of the
 * scenes it needs and just pass them to the current page when the current page
 * needs one.
 * 
 * Notice that this class is abstract, so you should derive a class from it if
 * you want to actually use it.
 * 
 * Note: The scene should be mounted to at most one HTMLElement at a time --
 *   trying to mount it to multiple will cause an error instead of mounting it.
 */
export class ThreeScene {
    protected _name: string;               // The name of this ThreeScene for error-message purposes
    protected _render: LimitFunc;          // Bounded render function

    protected _funcRollsRun: Set<string>;  // The functions that this ThreeScene have run so far in the "runOnce" function.

    protected _renderer: T.WebGLRenderer;  // The renderer that the scene uses
    protected _scene: T.Scene;             // The scene itself
    protected _views: WeakRefArray<SceneView>;         // An array of views of the scene

    protected _animationManager: AnimationManager;

    // The copyclone geometry that this ThreeScene keeps track of. This is
    // useful because these geometries will be copied/cloned when this
    // ThreeScene is copied/cloned.
    protected _copyCloneObjects: Object3D[];

    /**
     * Constructs a new ThreeScene object.
     * @param name The optional name of the ThreeScene.
     */
    constructor(name?: string) {
        // Figure out what name to use
        if (name !== undefined) {
            // use given name (do nothing)
        } else {
            // generate name
            let origName = "Scene";
            name = origName + (++numScenes);
            while (usedSceneNames.has(name)) {
                name = origName + (++numScenes);
            }
        }
        usedSceneNames.add(name);
        this._name = name;

        this._render = new LimitFunc(MAX_FRAMERATE, [
            () => {
                for (const view of this._views) {
                    this.drawTo(view);
                }
            }
        ]);

        this._funcRollsRun = new Set();

        this._renderer = webgl_renderer;

        // Setup Three defaults, you can change them as they do not depend on one another
        this._scene = new T.Scene();

        this._views = new WeakRefArray();

        this._animationManager = new AnimationManager();

        this._copyCloneObjects = [];
    }

    /**
     * Adds geometry to this ThreeScene that should be copied/cloned when this
     * ThreeScene is.
     * @param geom The geometry to add that should be copied/cloned when this
     * ThreeScene is.
     */
    addCopyCloneObject(geom: Object3D) {
        this._copyCloneObjects.push(geom);
        this._scene.add(geom);
    }

    /**
     * Sets the current AnimationManager that this ThreeScene
     * updates regularly to animate its contents.
     * @param animationManager The new animationManager.
     */
    setAnimationManager(animationManager:AnimationManager) {
        this._animationManager = animationManager;
        APP.updateUI();
        this.render();
    }
    /**
     * Returns The ThreeScene's name.
     * @returns The ThreeScene's name.
     */
    name():string{
        return this._name;
    }
    setName(name: string): void{
        this._name = name;
        APP.updateUI();
    }
    /**
     * Returns the ThreeScene's current AnimationManager.
     * @returns The ThreeScene's current AnimationManager.
     */
    animationManager():AnimationManager {
        return this._animationManager;
    }

    /**
     * Makes sure that a function with the given role only changes the
     * ThreeScene once during the entire lifespan of the ThreeScene. Useful for
     * initializing or doing something else only once ever. If you want a
     * function to always run, then just run it: don't use this
     * method.
     * @param funcRole The role of this function. If you want one function
     * or another to be run, but never both, then give them the same role.
     * @param func The function to run only if another function with its role
     * has not been run before.
     */
    runOnce(funcRole:string, func: () => void) {
        if (!this._funcRollsRun.has(funcRole)) {
            this._funcRollsRun.add(funcRole);
            func();
            this.render();
            APP.updateUI();
        }
    }

    /**
     * Returns the Threejs Scene that this object uses.
     */
    scene():T.Scene {
        return this._scene;
    }

    /**
     * Returns the current renderer that this ThreeScene is using.
     * @returns The current renderer that this ThreeScene is using.
     */
    renderer():T.Renderer {
        return this._renderer;
    }

    /**
     * Sets the renderer that this ThreeScene should use from now on.
     * @param renderer The new renderer.
     */
    setRenderer(renderer:T.WebGL1Renderer) {
        this._renderer = renderer
        this.render();
    }

    views(): ReadonlyArray<SceneView> {
        let out:SceneView[] = [];
        for (const val of this._views) {
            out.push(val);
        }
        return out;
    } 

    /**
     * Removes a view from the scene so that it is not automatically updated
     * every time the scene is rerendered.
     * @param view The view to be removed.
     */
    removeView(view:SceneView) {
        this._views.remove(view);
    }

    /**
     * Adds the given view to the scene so that it is drawn to every time the
     * ThreeScene is rerendered.
     * 
     * WARNING: A WEAKREF is kept, so some other object must have a reference to
     * the SceneView or else it will be deleted and thus its canvas will not
     * be rendered to any more.
     * @param view The SceneView to add.
     */
    addView(view:SceneView) {
        this._views.push(view);
    }

    /**
     * Requests that scene be rerendered to all SceneViews at the next available
     * timeslot in accordance to the maxFPS. The requests are not queued, so it
     * will handle all requests at the next available timeslot. If you want it
     * to render again after that, then you need to request it to render again
     * after that -- this way it only renders exactly as much as it needs to and
     * no more.
     */
    render() {
        this._render.call();
    }

    /**
     * Renders the ThreeScene based on the given view and draws the render
     * to the given view's canvas.
     */
    drawTo(view:SceneView) {
        const canvas = view.canvas();
        const camera = view.camera();
        let context = canvas.getContext('2d');
        if (context) {
            // Run any preprocessing that needs to happen (might need to change
            // the dimensions of the canvas or something else right before the
            // render).

            view.preprocess();

            this._renderer.setSize(canvas.width, canvas.height);

            if (camera instanceof T.PerspectiveCamera) {
                camera.aspect = canvas.width / canvas.height;
                camera.updateProjectionMatrix();
            }

            this._renderer.render(this._scene, camera);

            // Draw the image from the renderer's canvas to the given canvas
            if (this._renderer.domElement.width > 0 && this._renderer.domElement.height > 0) {
                context.drawImage(this._renderer.domElement, 0, 0);
            }

            view.postprocess();
        } else {
            console.error("A canvas could not be rendered to because its 2d context was null!");
        }
    }

    /**
     * Copies the contents of the given scene into this scene.
     * @param scene The scene to copy the contents of.
     * @param deep Whether the copy should be a deep copy or not.
     * @returns The given ThreeScene after it has copied the contents of this scene.
     * 
     * WARNING: The AnimationManager is not cloned because the ThreeScene cannot
     * know what is in itself and therefore how to clone the objects being
     * animated.
     */
    copy(scene:ThreeScene, deep:boolean=false, copyName: boolean = true, cloneTrace:boolean=true, robots: Map<Robot, Robot>): ThreeScene {
        if (copyName) {
            this._name = scene._name;
        }
        // for (const v of scene._funcRollsRun) {
        //     this._funcRollsRun.add(v);
        // }

        for (const obj of scene._copyCloneObjects) {
            this.addCopyCloneObject(obj.clone(true));
        }

        this._animationManager.copy(scene._animationManager, robots);

        return scene;
    }

    /**
     * Returns a clone of this ThreeScene.
     * @param deep Whether the clone should be a deep clone or not.
     * @returns The clone of this ThreeScene.
     * 
     * WARNING: The AnimationManager is not copied because the ThreeScene cannot
     * know what is in itself and therefore how to clone the objects being
     * animated.
     */
    clone(deep:boolean=false, cloneName:boolean=true, cloneTrace:boolean=true, robots: Map<Robot, Robot>): ThreeScene {
        return new ThreeScene().copy(this, deep, cloneName, cloneTrace ,robots);
    }
}
