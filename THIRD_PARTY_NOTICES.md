# Third-Party Notices

## OpenReel Video

The Timeline node's timeline architecture is adapted from design patterns in
[OpenReel Video](https://github.com/Augani/openreel-video), including a single
master timeline clock, immutable command history, and separation between
timeline state, playback, media management, UI, and rendering.

Newt Node does not vendor the OpenReel application or replace its existing
React Flow graph. The Timeline implementation is native to Newt Node and uses
the existing serialized node architecture and FFmpeg runtime.

OpenReel Video is licensed under the MIT License:

Copyright (c) 2025 Augani Oy

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
