// Hex bolt M6x40, axis +z, head on top (z 0 to 4), shank below (z -40 to 0). Invented for the prototype.
$fn = 32;
union() {
  cylinder(d = 11.5, h = 4, $fn = 6);
  translate([0, 0, -40]) cylinder(d = 6, h = 40.01);
}
