'use strict';
// One pixels-per-mm scale for both axes. Coverage also approximates thread thickness.
function wrapGeometry({turns, coverage, diameter, width: viewportWidth, height: viewportHeight, flat = false, screenScale = null}) {
 const length = turns * coverage;
 const physicalHeight = flat ? Math.PI * (diameter + coverage) : diameter + 2 * coverage;
 const pixelsPerMm = screenScale ?? Math.min(viewportWidth * .74 / length, viewportHeight * .30 / physicalHeight);
 const width = length * pixelsPerMm;
 const height = physicalHeight * pixelsPerMm;
 const centerY = screenScale === null ? viewportHeight * .43 : Math.max(viewportHeight * .43, 60 + height / 2);
 return {length, pixelsPerMm, width, height, left:(viewportWidth-width)/2,
  top:centerY-height/2, blankTop:centerY-diameter*pixelsPerMm/2,
  blankHeight:diameter*pixelsPerMm, pitch:coverage*pixelsPerMm};
}
function bandMetrics(band, coverage, diameter) {
 const strands = band.wrap === 'spiral' ? 2 : 1;
 const pitch = coverage * strands;
 return {strands, pitch, length:band.turns * pitch,
  threadLength:band.turns * strands * Math.hypot(Math.PI * (diameter + coverage), pitch) / 1000};
}
function wrapSummary(bands, coverage, diameter) {
 return bands.reduce((sum, band) => {
  const metric = bandMetrics(band, coverage, diameter);
  sum.turns += band.turns;
  sum.length += metric.length;
  sum.threadLength += metric.threadLength;
  return sum;
 }, {turns:0, length:0, threadLength:0});
}
// Advance along the blank over the visible front half (rod), or a full unrolled turn.
function spiralAdvance(fraction, pitch, flat, direction = 1) {
 return direction * pitch * (flat ? fraction : .25 + Math.asin(2 * fraction - 1) / (2 * Math.PI));
}
if (typeof module !== 'undefined') module.exports = {wrapGeometry, bandMetrics, wrapSummary, spiralAdvance};
