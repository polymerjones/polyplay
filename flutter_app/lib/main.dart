import 'package:flutter/material.dart';

void main() {
  runApp(const PolyplayApp());
}

class PolyplayApp extends StatelessWidget {
  const PolyplayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Polyplay Flutter',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF22D3EE)),
        useMaterial3: true,
      ),
      home: const PlayerHomePage(),
    );
  }
}

class PlayerHomePage extends StatefulWidget {
  const PlayerHomePage({super.key});

  @override
  State<PlayerHomePage> createState() => _PlayerHomePageState();
}

class _PlayerHomePageState extends State<PlayerHomePage> {
  final List<_Track> _tracks = const [
    _Track('Neon Drive', 'Mix v12', 3),
    _Track('Midnight Loop', 'Mix v7', 2),
    _Track('Glass Signal', 'Mix v3', 1),
  ];

  int _currentIndex = 0;
  bool _isPlaying = false;

  @override
  Widget build(BuildContext context) {
    final track = _tracks[_currentIndex];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Polyplay Music'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Now Playing', style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Text(track.title, style: Theme.of(context).textTheme.titleLarge),
                    Text('${track.sub} • Aura ${track.aura}/5'),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        FilledButton.tonal(
                          onPressed: _previous,
                          child: const Text('Prev'),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          onPressed: _togglePlay,
                          child: Text(_isPlaying ? 'Pause' : 'Play'),
                        ),
                        const SizedBox(width: 8),
                        FilledButton.tonal(
                          onPressed: _next,
                          child: const Text('Next'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView.separated(
                itemCount: _tracks.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final item = _tracks[index];
                  final selected = index == _currentIndex;
                  return ListTile(
                    selected: selected,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: selected ? Theme.of(context).colorScheme.primaryContainer : null,
                    title: Text(item.title),
                    subtitle: Text('${item.sub} • Aura ${item.aura}/5'),
                    onTap: () {
                      setState(() {
                        _currentIndex = index;
                        _isPlaying = true;
                      });
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _togglePlay() {
    setState(() {
      _isPlaying = !_isPlaying;
    });
  }

  void _previous() {
    setState(() {
      _currentIndex = (_currentIndex - 1 + _tracks.length) % _tracks.length;
      _isPlaying = true;
    });
  }

  void _next() {
    setState(() {
      _currentIndex = (_currentIndex + 1) % _tracks.length;
      _isPlaying = true;
    });
  }
}

class _Track {
  const _Track(this.title, this.sub, this.aura);

  final String title;
  final String sub;
  final int aura;
}
