const defaultScoringConfig = {
    max: 1_000_000_000_000,

    performancePortion: .5,
    podiumPortion: .5,

    secondPlaceDenominator: 2,
    thirdPlaceDenominator: 4,
};

const defaultRankingConfig = {
    tier1ScoreThreshold: 0,
    tier2Percentile: .5,
    tier3Percentile: .85,
};

// simulate(10, 1000, {min: .25, max: 1, resolution: .1}, {min: .1, max: 1, resolution: .1});
monteCarlo();

// Never got around to finishing this part, just running individual sims was enough.
function monteCarlo (
    simsPerParameterSet     = 1,
    // stepsPerParameterRange  = 10,
    numberOfGamesRange      = { min: 3,     max: 50,        resolution: 1, },
    numberOfPlayersRange    = { min: 5_000,   max: 50_000,   resolution: 5_000, },
    playerEngagementRange   = { min: .1,    max: 1,         resolution: .1, },
    scoreRandomnessRange    = { min: 0,     max: 1,         resolution: .1, },
) {
    let raw = [];

    let headers = `Players;\tGames;\t# R1;\t# R2;\t# R3;\t# UR;\tP1 Skill;\tP1 Podiums;\tP1 1sts;\tP1 2nds;\tP1 3rds;\tP1 Avg. Perf.;\tP1 Participation;\tP2 Podiums;\tP2 1sts;\tP2 2nds;\tP2 3rds;\tP2 Avg. Perf.;\tP2 Participation;\tP3 Podiums;\tP3 1sts;\tP3 2nds;\tP3 3rds;\tP3 Avg. Perf.;\tP3 Participation;\tR1 Avg. Perf.;\tR1 Participation;\tR2 Avg. Perf.;\tR2 Participation;\tR3 Avg. Perf.;\tR3 Participation;\tUR Avg. Perf.;\tUR Participation;`;
    console.log(headers)
    
    // console.log(stepsInParameterRange(numberOfGamesRange))
    // console.log(stepsInParameterRange(numberOfPlayersRange))
    // console.log(stepsInParameterRange(playerEngagementRange))
    // console.log(stepsInParameterRange(scoreRandomnessRange))
    for (const iG of stepsInParameterRange(numberOfGamesRange)) {
        for (const iP of stepsInParameterRange(numberOfPlayersRange)) {
            for (const i of range(simsPerParameterSet)) {
                raw.push(simulate(iG, iP, scoreRandomnessRange, playerEngagementRange));
            };
        };
    };
    return {
        raw,
    };
};

function simulate (
    numberOfGames,
    numberOfPlayers,
    randomnessRange,
    playerEngagementRange,
) {

    const players = range(numberOfPlayers).map(i => player(i, playerEngagementRange))
    const games = range(numberOfGames).map(i => game(i, randomnessRange));

    // Players randomly decide which games they will play
    // NOTE: this is probably slow AF
    for (const player of players) {
        // Players can't conceivably play more than a certain number of games due to time constraints
        // Would be good to have a # of plays factor... participation is this to a degree,
        // But if feels like it doesn't capture going deep vs going wide very well
        const gameCount = Math.min(Math.ceil(games.length * player.participation), 7);
        player.games = [];
        for (let i = 0; player.games.length < gameCount; i++) {
            if (Math.random() >= .5) {
                if (!player.games.includes(games[i % games.length].id)) {
                    player.games.push(games[i % games.length].id);
                };
            };
        };
    };

    // The players play the games
    let scores = [];
    for (const game of games) {
        for (const player of players.filter(player => player.games.includes(game.id))) {
            scores.push({
                player: player.id,
                game: game.id,
                score:
                    game.theoreticalMax
                    * (player.skill - ((game.randomness * Math.random()) * player.skill)),
            });
        };
    };

    // console.log(
    //     'The players play the games',
    //     // scores,
    // );

    // Calculate leaderboards, % performance and podiums for all games
    const tabulatedScores = games.reduce((agg, game) => {
        agg[game.id] = tabulateGameScores(game.id, scores)
        return agg;
    }, {});

    // Give players normalized scores for all games
    const normalizedScores = games.reduce((agg, game) => {
        agg[game.id] = players.reduce((agg, player) => {
            agg[player.id] = calculateGameScoreComponent(
                tabulatedScores[game.id].normalized[player.id],
                tabulatedScores[game.id].leaderboard.findIndex(score => score.player === player.id) + 1,
            );
            return agg;
        }, {});
        return agg;
    }, {});

    // console.log(
    //     'Give players normalized scores for all games',
    //     // normalizedScores,
    // );

    // Calculate leaderboard, % performance and podium for overall metascores
    const metascores = tabulateMetascores(players, normalizedScores);
    
    // console.log(
    //     // 'Calculate overall scores...',
    //     // metascores.podium,
    //     `${metascores.elite.length} elite ranked players,`,
    //     `${metascores.strong.length} strong ranked players,`,
    //     `${metascores.wooden.length} wooden ranked players,`,
    //     `${metascores.unranked.length} unranked players,`,
    // );

    const participation = tabulateParticipation(players, games, metascores);

    // console.log(
    //     'Tabulate participation',
    //     participation
    // )

    const performance = tabulatePerformance(players, games, metascores, tabulatedScores)

    // console.log(
    //     'Tabulate performance',
    //     performance
    // )

    // out = `${out}${pct(metascores.podium.first.skill)} P1 Skill;\t`;

    // out = `${out}${performance.rank1.podiums} P1 Podiums;\t`;
    // out = `${out}${performance.rank1.firsts} P1 1sts;\t`;
    // out = `${out}${performance.rank1.seconds} P1 2nds;\t`;
    // out = `${out}${performance.rank1.thirds} P1 3rds;\t`;
    // out = `${out}${pct(performance.rank1.averagePerformance)} P1 Avg. Perf.;\t`;
    // out = `${out}${pct(participation.rank1)} P1 Participation;\t`;
    
    // out = `${out}${performance.rank2.podiums} P2 Podiums;\t`;
    // out = `${out}${performance.rank2.firsts} P2 1sts;\t`;
    // out = `${out}${performance.rank2.seconds} P2 2nds;\t`;
    // out = `${out}${performance.rank2.thirds} P2 3rds;\t`;
    // out = `${out}${pct(performance.rank2.averagePerformance)} P2 Avg. Perf.;\t`;
    // out = `${out}${pct(participation.rank2)} P2 Participation;\t`;
    
    // out = `${out}${performance.rank3.podiums} P3 Podiums;\t`;
    // out = `${out}${performance.rank3.firsts} P3 1sts;\t`;
    // out = `${out}${performance.rank3.seconds} P3 2nds;\t`;
    // out = `${out}${performance.rank3.thirds} P3 3rds;\t`;
    // out = `${out}${pct(performance.rank3.averagePerformance)} P3 Avg. Perf.;\t`;
    // out = `${out}${pct(participation.rank3)} P3 Participation;\t`;

    // out = `${out}${pct(performance.elite.averagePerformance)} R1 Avg. Perf.;\t`;
    // out = `${out}${pct(participation.elite)} R1 Participation;\t`;

    // out = `${out}${pct(performance.strong.averagePerformance)} R2 Avg. Perf.;\t`;
    // out = `${out}${pct(participation.strong)} R2 Participation;\t`;

    // out = `${out}${pct(performance.wooden.averagePerformance)} R3 Avg. Perf.;\t`;
    // out = `${out}${pct(participation.wooden)} R3 Participation;\t`;

    // out = `${out}${pct(performance.unranked.averagePerformance)} UR Avg. Perf.;\t`;
    // out = `${out}${pct(participation.unranked)} UR Participation;\t`;

    let out = `${numberOfPlayers};\t${numberOfGames};\t`
    out = `${out}${metascores.elite.length};\t${metascores.strong.length};\t${metascores.wooden.length};\t${metascores.unranked.length};\t`
    out = `${out}${pct(metascores.podium.first.skill)};\t`;

    out = `${out}${performance.rank1.podiums};\t`;
    out = `${out}${performance.rank1.firsts};\t`;
    out = `${out}${performance.rank1.seconds};\t`;
    out = `${out}${performance.rank1.thirds};\t`;
    out = `${out}${pct(performance.rank1.averagePerformance)};\t`;
    out = `${out}${pct(participation.rank1)};\t`;
    
    out = `${out}${performance.rank2.podiums};\t`;
    out = `${out}${performance.rank2.firsts};\t`;
    out = `${out}${performance.rank2.seconds};\t`;
    out = `${out}${performance.rank2.thirds};\t`;
    out = `${out}${pct(performance.rank2.averagePerformance)};\t`;
    out = `${out}${pct(participation.rank2)};\t`;
    
    out = `${out}${performance.rank3.podiums};\t`;
    out = `${out}${performance.rank3.firsts};\t`;
    out = `${out}${performance.rank3.seconds};\t`;
    out = `${out}${performance.rank3.thirds};\t`;
    out = `${out}${pct(performance.rank3.averagePerformance)};\t`;
    out = `${out}${pct(participation.rank3)};\t`;

    out = `${out}${pct(performance.elite.averagePerformance)};\t`;
    out = `${out}${pct(participation.elite)};\t`;

    out = `${out}${pct(performance.strong.averagePerformance)};\t`;
    out = `${out}${pct(participation.strong)};\t`;

    out = `${out}${pct(performance.wooden.averagePerformance)};\t`;
    out = `${out}${pct(participation.wooden)};\t`;

    out = `${out}${pct(performance.unranked.averagePerformance)};\t`;
    out = `${out}${pct(participation.unranked)};\t`;

    console.log(out);

    return {
        // Input parameters
        numberOfGames,
        numberOfPlayers,
        randomnessRange,
        playerEngagementRange,
        // Tabulated output
        participation,
        // podiumRate,
        // Raw output
        scores,
    };
};

// Simulation entities

function game (
    id,
    randomnessRange,
) {
    return {
        id,
        theoreticalMax: Math.random() * 1_000_000_000_000,
        randomness: randomInRange(randomnessRange),
    };
}

function player (
    id,
    participationRange,
) {
    return {
        id,
        skill: Math.random(),
        participation: randomInRange(participationRange),
    };
};

// Tabulation

function tabulatePerformance (
    players,
    games,
    metascores,
    tabulatedScores,
) {
    function countPlayerPlacing (player, placingMin, placingMax) {
        return Object.keys(tabulatedScores).reduce((agg, game) => {
            const placing = tabulatedScores[game].leaderboard.findIndex(x => x.player === player);
            if (placing >= placingMin && placing <= placingMax) {
                agg += 1;
            }
            return agg;
        }, 0)
    };
    function tabulatePodiums (player) {
        return {
            podiums: countPlayerPlacing(player, 0, 2),
            firsts: countPlayerPlacing(player, 0, 0),
            seconds: countPlayerPlacing(player, 1, 1),
            thirds: countPlayerPlacing(player, 2, 2),
        }
    };
    function getAveragePerformance (player) {
        return Object.keys(tabulatedScores).reduce((agg, game) => {
            agg += tabulatedScores[game].normalized[player] || 0;
            return agg;
        }, 0) / players.find(x => x.id === player).games.length;
    };
    const rank1 = {
        ...tabulatePodiums(metascores.podium.first.player),
        averagePerformance: getAveragePerformance(metascores.podium.first.player),
    };
    const rank2 = {
        ...tabulatePodiums(metascores.podium.second.player),
        averagePerformance: getAveragePerformance(metascores.podium.second.player),
    };
    const rank3 = {
        ...tabulatePodiums(metascores.podium.third.player),
        averagePerformance: getAveragePerformance(metascores.podium.third.player),
    };
    const elite = {
        averagePerformance: metascores.elite.reduce((agg, player, i) => {
            return agg + getAveragePerformance(player.id);
        }, 0) / metascores.elite.length,
    };
    const strong = {
        averagePerformance: metascores.strong.reduce((agg, player, i) => {
            return agg + getAveragePerformance(player.id);
        }, 0) / metascores.strong.length,
    };
    const wooden = {
        averagePerformance: metascores.wooden.reduce((agg, player, i) => {
            return agg + getAveragePerformance(player.id);
        }, 0) / metascores.wooden.length,
    };
    const unranked = {
        averagePerformance: metascores.unranked.reduce((agg, player, i) => {
            return agg + getAveragePerformance(player.id);
        }, 0) / metascores.unranked.length,
    };
    return {
        rank1,
        rank2,
        rank3,
        elite,
        strong,
        wooden,
        unranked,
    };
};

function tabulateParticipation (
    players,
    games,
    metascores,
) {
    function rate (player, games) {
        return player.games.length / games.length;
    };
    const total = players.reduce((agg, player) => {
        agg += rate(player, games);
        return agg;
    }, 0) / players.length;
    const rank1 = rate(players.find(x => x.id === metascores.podium.first.player), games);
    const rank2 = rate(players.find(x => x.id === metascores.podium.second.player), games);
    const rank3 = rate(players.find(x => x.id === metascores.podium.third.player), games);
    const podium = (rank1 + rank2 + rank3) / 3;
    const unranked = metascores.unranked.reduce((agg, player) => {
        agg += rate(player, games);
        return agg;
    }, 0) / metascores.unranked.length;
    const wooden = metascores.wooden.reduce((agg, player) => {
        agg += rate(player, games);
        return agg;
    }, 0) / metascores.wooden.length;
    const strong = metascores.strong.reduce((agg, player) => {
        agg += rate(player, games);
        return agg;
    }, 0) / metascores.strong.length;
    const elite = metascores.elite.reduce((agg, player) => {
        agg += rate(player, games);
        return agg;
    }, 0) / metascores.elite.length;
    return {
        total,
        rank1,
        rank2,
        rank3,
        elite,
        strong,
        wooden,
        podium,
        unranked,
    };
}

function tabulateGameScores (
    game,
    scores,
) {
    scores = scores.filter(score => score.game === game);
    const leaderboard = scores.sort((a, b) => b.score - a.score);
    const normalized = scores.reduce((agg, score, i) => {
        agg[score.player] = score.score / leaderboard[0].score;
        return agg;
    }, {});
    const podium = {
        first: leaderboard[0],
        second: leaderboard[1],
        third: leaderboard[2],
    };
    return {
        leaderboard,
        normalized,
        podium,
    };
};

function tabulateMetascores (
    players,
    normalizedScores,
    config=defaultRankingConfig,
) {
    function percentileRanks (leaderboard) {
        const normalized = leaderboard.reduce((agg, x, i) => {
            agg[x.player] = 1 - i / (players.length - 1)
            return agg;
        }, {});
        const wooden = players.filter(player => {
            return scores[player.id] >= config.tier1ScoreThreshold
                && normalized[player.id] <= config.tier2Percentile;
        });
        const strong = players.filter(player => {
            return normalized[player.id] > config.tier2Percentile
                && normalized[player.id] <= config.tier3Percentile;
        });
        const elite = players.filter(player => {
            return normalized[player.id] > config.tier3Percentile
                && leaderboard.findIndex(x => x.player === player.id) > 2;
        });
        return { normalized, wooden, strong, elite };
    };

    function pctOfTopScoreRanks (leaderboard) {
        const normalized = leaderboard.reduce((agg, x, i) => {
            agg[x.player] = x.score / leaderboard[0].score
            return agg;
        }, {});
        const wooden = players.filter(player => {
            return scores[player.id] >= config.tier1ScoreThreshold
                && normalized[player.id] <= config.tier2Percentile;
        });
        const strong = players.filter(player => {
            return normalized[player.id] > config.tier2Percentile
                && normalized[player.id] <= config.tier3Percentile;
        });
        const elite = players.filter(player => {
            return normalized[player.id] > config.tier3Percentile
                && leaderboard.findIndex(x => x.player === player.id) > 2;
        });
        return { normalized, wooden, strong, elite };
    };

    const scores = Object.values(normalizedScores).reduce((agg, game) => {
        for (const player in game) {
            const score = game[player];
            if (agg[player]) {
                agg[player] += score;
            } else {
                agg[player] = score;
            }
        };
        return agg;
    }, {});

    const leaderboard = players
    .sort((a, b) => scores[b.id] - scores[a.id])
    .reduce((agg, player) => {
        agg.push({
            player: player.id,
            score: scores[player.id],
            skill: player.skill,
        });
        return agg;
    }, []);
    
    const podium = {
        first: leaderboard[0],
        second: leaderboard[1],
        third: leaderboard[2],
    };

    const unranked = players.filter(player => {
        return scores[player.id] < config.tier1ScoreThreshold;
    });

    // const { normalized, wooden, strong, elite } = pctOfTopScoreRanks(leaderboard);
    const { normalized, wooden, strong, elite } = percentileRanks(leaderboard);

    return {
        scores,
        leaderboard,
        normalized,
        podium,
        unranked,
        wooden,
        strong,
        elite,
    };
};

// Mock metascore functions

function calculateGameScoreComponent (
    normalizedPerformance,
    rank,
    {
        max,
        performancePortion,
        podiumPortion,
        secondPlaceDenominator,
        thirdPlaceDenominator,
    } = defaultScoringConfig,
) {
    if (
        performancePortion
        + podiumPortion
        !== 1
    ) throw new Error('Scoring portions must sum to 1.');
    if (
        normalizedPerformance === undefined ||
        rank === undefined
    ) return 0;
    // First portion of score is awarded based on (player score ÷ top score)
    let score = max * normalizedPerformance * performancePortion;
    // Second portion of score is awarded based on podium placement
    if (rank === 3) score += max * podiumPortion / thirdPlaceDenominator;
    if (rank === 2) score += max * podiumPortion / secondPlaceDenominator;
    if (rank === 1) score += max * podiumPortion;
    return Math.floor(score);
};

// Utils

function randomInRange (
    range,
) {
    return range.min + Math.random() * ( range.max - range.min);
};

function stepsInParameterRange (
    range,
    numberOfSteps,
) {
    // Get a list of the unique values that need to be simulated
    // without exceeding range.resolution or numberOfSteps
    const allowFloats = Number.isInteger(range.resolution) === false;
    let interval = range.resolution;
    if ((rangeDelta(range) / numberOfSteps) > range.resolution) {
        interval = rangeDelta(range) / numberOfSteps;
        interval = allowFloats ? interval : Math.floor(interval);
    }
    let steps = [];
    let agg = range.min;
    while (agg <= range.max) {
        steps.push(agg);
        agg += interval;
    }
    return steps;
};

function range (n) {
    return Array.from(Array(n).keys());
};

function rangeDelta ({min, max}) {
    return max - min;
};

function pct (n) {
    return Math.round(n * 100) + '%';
}