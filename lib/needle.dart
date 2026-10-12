import 'dart:async';
import 'dart:convert';
import 'dart:ffi';
import 'dart:io';
import 'dart:isolate';
import 'package:ffi/ffi.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'domain.dart';

class IntentResult {
  final Map<String, String>? intent;
  final double confidence;
  const IntentResult(this.intent, this.confidence);
}

final intentTool = [
  {
    'name': 'retrieve_arguments',
    'description':
        'Find an existing theological study. Interpret Portuguese, English or Spanish. Do not answer theology. For a defense or refutation choose presbyterian_apologetics; for explaining a tradition choose impersonal.',
    'parameters': {
      'type': 'object',
      'properties': {
        'intent': {
          'type': 'string',
          'enum': ['compare_doctrines'],
        },
        'mode': {'type': 'string', 'enum': intentModes},
        'primary': {
          'type': 'string',
          'enum': ['presbyterian'],
        },
        'target': {'type': 'string', 'enum': traditions},
        'topic': {'type': 'string', 'enum': topics},
        'action': {
          'type': 'string',
          'enum': ['retrieve_arguments'],
        },
      },
      'required': ['intent', 'mode', 'primary', 'target', 'topic', 'action'],
    },
  },
];

class NeedleInterpreter {
  static Future<void> tail = Future.value();
  static String? modelPath;
  static Future<IntentResult> interpret(String prompt) {
    final result = Completer<IntentResult>();
    tail = tail.then((_) async {
      try {
        if (!Platform.isAndroid && !Platform.isIOS) {
          result.complete(const IntentResult(null, 0));
          return;
        }
        if (modelPath == null) {
          final dir = await getApplicationSupportDirectory();
          final f = File('${dir.path}/needle2.cact');
          if (!await f.exists()) {
            final data = await rootBundle.load('assets/content/needle2.cact');
            await f.writeAsBytes(
              data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
              flush: true,
            );
          }
          modelPath = f.path;
        }
        final path = modelPath!;
        final raw = await Isolate.run(
          () => nativeInterpret(
            path,
            prompt.substring(0, prompt.length.clamp(0, 1000)),
            jsonEncode(intentTool),
          ),
        );
        final object = jsonDecode(raw);
        final confidence = (object['confidence'] as num? ?? 0).toDouble();
        final calls = object['function_calls'];
        Map<String, String>? intent;
        if (object['type'] == 'call' &&
            confidence >= .85 &&
            calls is List &&
            calls.length == 1 &&
            calls.first['name'] == 'retrieve_arguments') {
          intent = validateIntent(calls.first['arguments']);
        }
        result.complete(IntentResult(intent, confidence));
      } catch (e) {
        result.complete(const IntentResult(null, 0));
      }
    });
    return result.future;
  }
}

String nativeInterpret(String path, String prompt, String tools) {
  final library = Platform.isAndroid
      ? DynamicLibrary.open('libneedle_runtime.so')
      : DynamicLibrary.process();
  final load = library
          .lookupFunction<
            Int32 Function(Pointer<Utf8>, Pointer<Utf8>),
            int Function(Pointer<Utf8>, Pointer<Utf8>)
          >('br_load'),
      complete = library
          .lookupFunction<
            Int32 Function(Pointer<Utf8>, Pointer<Utf8>, Int32),
            int Function(Pointer<Utf8>, Pointer<Utf8>, int)
          >('br_complete');
  final p = path.toNativeUtf8(),
      t = tools.toNativeUtf8(),
      q = prompt.toNativeUtf8(),
      out = calloc<Uint8>(32768).cast<Utf8>();
  try {
    final init = load(p, t);
    if (init < 0) throw StateError('Needle initialization: $init');
    final rc = complete(q, out, 32768);
    if (rc < 0) throw StateError('Needle completion: $rc');
    return out.toDartString();
  } finally {
    calloc.free(p);
    calloc.free(t);
    calloc.free(q);
    calloc.free(out);
  }
}
