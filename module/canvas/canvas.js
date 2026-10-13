/**
 * Measure the distance between two pixel coordinates
 * See BaseGrid.measureDistance for more details
 */
export const measureDistances = function(segments, options={}) {
  if ( !options.gridSpaces ) return BaseGrid.prototype.measureDistances.call(this, segments, options);

  // Track the total number of diagonals
  let nDiagonal = 0;
  //const rule = this.parent.diagonalRule;
  const d = canvas.dimensions;

  // Iterate over measured segments
  return segments.map(s => {
    let r = s.ray;

    // Determine the total distance traveled
    let nx = Math.abs(Math.ceil(r.dx / d.size));
    let ny = Math.abs(Math.ceil(r.dy / d.size));

    // Determine the number of straight and diagonal moves
    let nd = Math.min(nx, ny);
    let ns = Math.abs(ny - nx);
    nDiagonal += nd;

    // Alternative DMG Movement
    //if (rule === "5105") {
      let nd10 = Math.floor(nDiagonal / 2) - Math.floor((nDiagonal - nd) / 2);
      let spaces = (nd10 * 2) + (nd - nd10) + ns;
      return spaces * canvas.dimensions.distance;
    //}

    // Standard PHB Movement
    //else return (ns + nd) * canvas.scene.data.gridDistance;
  });
};

export const measureDistance = function(p0, p1, {gridSpaces=true}={}) {
  if ( !gridSpaces ) return BaseGrid.prototype.measureDistance.bind(this)(p0, p1, {gridSpaces});
  let gs = canvas.dimensions.size,
      ray = new Ray(p0, p1),
      nx = Math.abs(Math.ceil(ray.dx / gs)),
      ny = Math.abs(Math.ceil(ray.dy / gs));

  // Get the number of straight and diagonal moves
  let nDiagonal = Math.min(nx, ny),
      nStraight = Math.abs(ny - nx);

  // Alternative DMG Movement
  if ( this.parent.diagonalRule === "5105" ) {
    let nd10 = Math.floor(nDiagonal / 2);
    let spaces = (nd10 * 2) + (nDiagonal - nd10) + nStraight;
    return spaces * canvas.dimensions.distance;
  }

  // Standard PHB Movement
  else return (nStraight + nDiagonal) * canvas.scene.data.gridDistance;
};