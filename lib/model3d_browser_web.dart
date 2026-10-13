import 'dart:async';
import 'dart:convert';
import 'dart:html' as html;
import 'dart:ui_web' as ui_web;
import 'package:flutter/widgets.dart';

class Browser3D {
  static int counter = 0;
  final String viewType = 'biblia3d-${++counter}';
  html.IFrameElement? frame;
  StreamSubscription<html.MessageEvent>? messages;
  void Function(String)? onStatus;

  Widget view(String filename,{void Function(String)? status}) {
    onStatus = status;
    if (!RegExp(r'^[a-zA-Z0-9_-]+\.glb$').hasMatch(filename)) {
      return const Center(child: Text('Arquivo de modelo 3D inválido.'));
    }
    if (frame == null) {
      frame = html.IFrameElement()
        ..src = 'assets/assets/3d/viewer_immersive.html?model=${Uri.encodeComponent(filename)}'
        ..title = 'Reconstrução bíblica 3D'
        ..style.border = '0'
        ..style.width = '100%'
        ..style.height = '100%';
      ui_web.platformViewRegistry.registerViewFactory(viewType,(int _) => frame!);
      messages = html.window.onMessage.listen((event) {
        if (event.origin != html.window.location.origin) return;
        final data=event.data;
        if (data is String && data.startsWith('biblia3d:')) {
          onStatus?.call(data.substring('biblia3d:'.length));
        }
      });
    }
    return HtmlElementView(viewType:viewType);
  }

  void send(String command,[Object? value]) {
    frame?.contentWindow?.postMessage(
      jsonEncode({'channel':'biblia3d','name':command,'value':value}),
      html.window.location.origin,
    );
  }

  void dispose() {
    messages?.cancel();
    frame?.remove();
    frame=null;
  }
}
