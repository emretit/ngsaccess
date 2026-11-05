import 'dart:math' as math;
import 'package:flutter/material.dart';

double contrast(Color foreground, Color background) {
  final first = foreground.computeLuminance();
  final second = background.computeLuminance();
  return (math.max(first, second) + .05) / (math.min(first, second) + .05);
}
