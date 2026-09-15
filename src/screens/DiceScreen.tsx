import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

// Dice dot positions for each face (1-6)
const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DiceFace({ value, size = 64 }: { value: number; size?: number }) {
  const dots = DICE_DOTS[value] || [];
  return (
    <View style={[styles.dice, { width: size, height: size }]}>
      {dots.map(([x, y], i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              left: `${x}%`,
              top: `${y}%`,
              width: size * 0.18,
              height: size * 0.18,
              marginLeft: -(size * 0.09),
              marginTop: -(size * 0.09),
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function DiceScreen() {
  const [diceCount, setDiceCount] = useState(2);
  const [results, setResults] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<{ total: number; count: number }[]>([]);

  const rollDice = () => {
    setRolling(true);
    // Animate for a bit
    let count = 0;
    const interval = setInterval(() => {
      setResults(
        Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1)
      );
      count++;
      if (count >= 8) {
        clearInterval(interval);
        const finalResults = Array.from(
          { length: diceCount },
          () => Math.floor(Math.random() * 6) + 1
        );
        setResults(finalResults);
        setRolling(false);
        const total = finalResults.reduce((sum, n) => sum + n, 0);
        setHistory((prev) => [{ total, count: diceCount }, ...prev].slice(0, 10));
      }
    }, 80);
  };

  const total = results.reduce((sum, n) => sum + n, 0);

  return (
    <View style={styles.container}>
      {/* Dice Count Selector */}
      <View style={styles.selector}>
        <Text style={styles.selectorLabel}>骰子数量</Text>
        <View style={styles.selectorRow}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Pressable
              key={n}
              style={[styles.selectorBtn, diceCount === n && styles.selectorBtnActive]}
              onPress={() => setDiceCount(n)}
            >
              <Text
                style={[
                  styles.selectorText,
                  diceCount === n && styles.selectorTextActive,
                ]}
              >
                {n}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Dice Display */}
      <View style={styles.diceArea}>
        <View style={styles.diceGrid}>
          {results.length === 0
            ? Array.from({ length: diceCount }, (_, i) => (
                <View key={i} style={[styles.dice, styles.diceEmpty]}>
                  <Text style={styles.dicePlaceholder}>?</Text>
                </View>
              ))
            : results.map((value, i) => (
                <View key={i} style={rolling ? styles.diceRollingWrapper : undefined}>
                  <DiceFace value={value} />
                </View>
              ))}
        </View>

        {results.length > 0 && !rolling ? (
          <Text style={styles.total}>
            总计：<Text style={styles.totalNum}>{total}</Text>
          </Text>
        ) : null}
      </View>

      {/* Roll Button */}
      <Pressable
        style={[styles.rollBtn, rolling && styles.rollBtnDisabled]}
        onPress={rollDice}
        disabled={rolling}
      >
        <Text style={styles.rollBtnText}>
          {rolling ? '🎲 投掷中…' : '🎲 扔骰子'}
        </Text>
      </Pressable>

      {/* History */}
      {history.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>历史记录</Text>
          {history.map((item, i) => (
            <View key={i} style={styles.historyItem}>
              <Text style={styles.historyText}>
                {item.count} 个骰子 → <Text style={styles.historyTotal}>{item.total}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
  },
  selector: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 8,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  selectorBtnActive: {
    backgroundColor: colors.orange,
  },
  selectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  selectorTextActive: {
    color: '#fff',
  },
  diceArea: {
    alignItems: 'center',
    marginVertical: 36,
  },
  diceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  dice: {
    backgroundColor: colors.card,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  diceEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  dicePlaceholder: {
    fontSize: 28,
    color: colors.subtext,
    fontWeight: '600',
  },
  dot: {
    position: 'absolute',
    backgroundColor: colors.text,
    borderRadius: 999,
  },
  diceRollingWrapper: {
    transform: [{ rotate: '8deg' }],
  },
  total: {
    fontSize: 16,
    color: colors.subtext,
    marginTop: 24,
  },
  totalNum: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.orange,
  },
  rollBtn: {
    backgroundColor: colors.orange,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  rollBtnDisabled: {
    opacity: 0.7,
  },
  rollBtnText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  history: {
    marginTop: 24,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  historyItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyText: {
    fontSize: 14,
    color: colors.subtext,
  },
  historyTotal: {
    fontWeight: '700',
    color: colors.orange,
  },
});
