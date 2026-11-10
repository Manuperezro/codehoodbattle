import React from 'react';
import { Trophy, Medal, Award, CheckCircle2, Clock, Info } from 'lucide-react';
import { LeaderboardEntry } from '../types/game';

interface LiveLeaderboardProps {
  entries: LeaderboardEntry[];
  currentRound: number;
  totalRounds: number;
  isDemoMode: boolean;
  isFinalPodium?: boolean;
  highlightPlayerId?: string;
}

export const LiveLeaderboard: React.FC<LiveLeaderboardProps> = ({
  entries,
  currentRound,
  totalRounds,
  isDemoMode,
  isFinalPodium = false,
  highlightPlayerId,
}) => {
  const sorted = [...entries].sort((a, b) => b.totalPoints - a.totalPoints);
  const topThree = sorted.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Demo Mode explicit banner required by Section 20 */}
      {isDemoMode && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-400/50 text-amber-200 text-xs sm:text-sm">
          <Info className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <strong>DEMO MODE SAMPLE LEADERBOARD:</strong> Supabase is not yet configured, so this leaderboard shows simulated classroom competitors stored locally in your browser. Configure Supabase to enable real-time multi-device synchronisation.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold uppercase">
          <Trophy className="w-4 h-4" />
          {isFinalPodium
            ? 'Final Championship Podium'
            : `Live Standings • Round ${currentRound} of ${totalRounds}`}
        </div>
        <h2 className="text-2xl sm:text-4xl font-display font-bold text-white">
          {isFinalPodium ? 'Python Code Arena Champions!' : 'Championship Leaderboard'}
        </h2>
      </div>

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end max-w-4xl mx-auto">
          {/* 2nd Place */}
          {topThree[1] && (
            <div className="order-2 md:order-1 rounded-2xl border-2 border-slate-400/50 bg-slate-900/90 p-5 text-center shadow-xl">
              <Medal className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <div className="text-xs font-mono uppercase text-slate-400 font-bold">
                2nd Place
              </div>
              <div className="text-xl font-display font-bold text-white mt-1 truncate">
                {topThree[1].nickname}
              </div>
              <div className="text-2xl font-mono font-extrabold text-slate-200 mt-2">
                {topThree[1].totalPoints} pts
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {topThree[1].challengesCompleted} solved
              </div>
            </div>
          )}

          {/* 1st Place */}
          {topThree[0] && (
            <div className="order-1 md:order-2 rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-500/25 to-slate-900/95 p-6 text-center shadow-2xl shadow-amber-500/15 transform md:-translate-y-2">
              <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
              <div className="text-xs font-mono uppercase text-amber-300 font-bold">
                1st Place Champion
              </div>
              <div className="text-2xl font-display font-bold text-white mt-1 truncate">
                {topThree[0].nickname}
              </div>
              <div className="text-3xl font-mono font-extrabold text-amber-300 mt-2">
                {topThree[0].totalPoints} pts
              </div>
              <div className="text-xs text-amber-200/80 mt-1">
                {topThree[0].challengesCompleted} solved
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {topThree[2] && (
            <div className="order-3 rounded-2xl border-2 border-orange-500/50 bg-slate-900/90 p-5 text-center shadow-xl">
              <Award className="w-10 h-10 text-orange-400 mx-auto mb-2" />
              <div className="text-xs font-mono uppercase text-orange-300 font-bold">
                3rd Place
              </div>
              <div className="text-xl font-display font-bold text-white mt-1 truncate">
                {topThree[2].nickname}
              </div>
              <div className="text-2xl font-mono font-extrabold text-orange-300 mt-2">
                {topThree[2].totalPoints} pts
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {topThree[2].challengesCompleted} solved
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Leaderboard Table (Only Nicknames & Scores — No Sensitive Data) */}
      <div className="rounded-2xl border-2 border-arena-border bg-arena-card/95 overflow-hidden shadow-xl max-w-4xl mx-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-xs font-mono uppercase text-slate-400">
                <th className="py-3.5 px-4">Rank</th>
                <th className="py-3.5 px-4">Nickname</th>
                <th className="py-3.5 px-4 text-center">Challenges Solved</th>
                <th className="py-3.5 px-4 text-center">Round {currentRound}</th>
                <th className="py-3.5 px-4 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm sm:text-base">
              {sorted.map((entry, idx) => {
                const rank = idx + 1;
                const isMe = entry.playerId === highlightPlayerId;
                return (
                  <tr
                    key={entry.playerId}
                    className={`${
                      isMe
                        ? 'bg-sky-500/15 font-semibold'
                        : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                      #{rank}
                    </td>
                    <td className="py-3.5 px-4 font-display font-bold text-white">
                      {entry.nickname}
                      {isMe && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-sky-500/30 text-sky-200 text-xs font-mono">
                          YOU
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                      {entry.challengesCompleted}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {entry.currentRoundSubmitted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5" /> +
                          {entry.currentRoundPoints}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono">
                          <Clock className="w-3.5 h-3.5" /> Coding...
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-lg text-amber-300">
                      {entry.totalPoints} pts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

