import T from "./true_three";

export class ArrowHelper extends T.Group {
    protected _toPos: T.Vector3;
    protected _fromPos: T.Vector3;
    protected _length: number;
    protected _shaftRadius: number;
    protected _shaftLenPercent: number;
    protected _shaftColor: T.ColorRepresentation;
    protected _headColor: T.ColorRepresentation;
    protected _headRadius: number;

    protected _arrowGroup?: T.Group;
    protected _onUpdate: () => void;

    constructor({
            toPos,
            fromPos,
            length=1,
            shaftRadius=0.5,
            shaftLenPercent=0.75,
            shaftColor='blue',
            headColor='green',
            headRadius=0.75,
            onUpdate=() => {}
    }:{
            toPos?:T.Vector3,
            fromPos?:T.Vector3,
            length?:number,
            shaftRadius?:number,
            shaftLenPercent?:number,
            shaftColor?:T.ColorRepresentation,
            headColor?:T.ColorRepresentation,
            headRadius?:number,
            onUpdate?: () => void
    }) {
        super();

        this._toPos = toPos === undefined ? new T.Vector3(0, 1, 0) : new T.Vector3().copy(toPos);
        this._fromPos = fromPos === undefined ? new T.Vector3(0, 0, 0) : new T.Vector3().copy(fromPos);
        this._length = length;
        this._shaftRadius = shaftRadius;
        this._shaftLenPercent = shaftLenPercent; 
        this._shaftColor = shaftColor;
        this._headColor = headColor;
        this._headRadius = headRadius;
        this._onUpdate = onUpdate;

        this.update();
    }

    /**
     * Sets the position that the arrow is pointing from.
     * @param pos The position that the base of the arrow's shaft should be at.
     * @param updateLength Whether to update the length so that the
     * base of the arrow is at the `from` position and the tip of it is at
     * the `to` position.
     */
    setFromPos(pos:T.Vector3, updateLength:boolean=true) {
        this._fromPos = new T.Vector3().copy(pos);
        this.position.copy(this._fromPos);
        if (updateLength) {
            this.updateLength();
        }
    }
    
    /**
     * Sets the position that the arrow is pointing to.
     * @param pos The position that the arrow should point towards.
     * @param updateLength Whether to update the length so that the
     * base of the arrow is at the `from` position and the tip of it is at
     * the `to` position.
     */
    setToPos(pos:T.Vector3, updateLength:boolean=true) {
        this._toPos = new T.Vector3().copy(pos);
        this.lookAt(this._toPos);
        if (updateLength) {
            this.updateLength();
        }
    }

    /**
     * Sets the length of the arrow, from base to tip, to the given length.
     * @param length The new length of the arrow.
     */
    setLength(length:number) {
        this._length = length;
        this.update();
    }

    /**
     * Updates the length of this ArrowHelper so that the base of its base will
     * be at the `from` position and the tip of its tip will be at the `to`
     * position.
     */
    updateLength() {
        this._length = this._fromPos.distanceTo(this._toPos);
        this.update();
    }

    /**
     * Updates the arrow to reflect its current state.
     */
    update() {
        if (this._arrowGroup !== undefined) {
            this.remove(this._arrowGroup);
            this._arrowGroup = undefined;
        }

        const group = new T.Group();

        // Uncomment to show where origin (base) of the arrow is
//        const sphere = new T.Mesh(
//            new T.SphereGeometry( 0.1, 0.1, 0.1 ),
//            new T.MeshBasicMaterial({
//                transparent: true,
//                opacity: .1,
//                side: T.DoubleSide,
//            })
//        );
//        group.add(sphere);
        

        const shaftLen = this._length * this._shaftLenPercent;
        const shaftGeom = new T.CylinderGeometry(
                this._shaftRadius,
                this._shaftRadius,
                shaftLen,
                30
        );
        const shaftMat = new T.MeshBasicMaterial({
            color: this._shaftColor
        });
        const arrowShaft = new T.Mesh(
            shaftGeom,
            shaftMat,
        );

        const headLen = this._length - shaftLen;
        const headGeom = new T.ConeGeometry(
                this._headRadius, // Radius
                headLen,          // Length
                30                // Radial Segments
        );
        const headMat = new T.MeshBasicMaterial({ color: this._headColor });
        const arrowHead = new T.Mesh(
            headGeom,
            headMat
        );

        arrowShaft.add(arrowHead);

        // put the arrow's head at the top of the shaft
        arrowHead.position.y = (shaftLen / 2) + (headLen / 2);

        // point the shaft in the z-direction
        arrowShaft.rotation.x = Math.PI / 2;
        arrowShaft.position.z += shaftLen / 2;

        group.add(arrowShaft);

        this._arrowGroup = group;
        this.add(this._arrowGroup);

        this._onUpdate();
    }
}