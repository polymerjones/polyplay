import 'package:flutter_test/flutter_test.dart';
import 'package:polyplay_flutter/main.dart';

void main() {
  testWidgets('app renders now playing header', (tester) async {
    await tester.pumpWidget(const PolyplayApp());
    expect(find.text('Now Playing'), findsOneWidget);
  });
}
