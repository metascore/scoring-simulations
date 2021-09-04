const defaultScoringConfig = {
    max: 1_000_000_000_000,

    participationPortion: .2,
    performancePortion: .3,
    podiumPortion: .5,

    secondPlaceDenominator: 2,
    thirdPlaceDenominator: 4,
};

const defaultRankingConfig = {
    tier1ScoreThreshold: 1_000_000_000_000,
    tier2Percentile: .5,
    tier3Percentile: .85,
};

simulate(5, 10000, {min: .25, max: 1, resolution: .1}, {min: .1, max: 1, resolution: .1});

// function monteCarlo (
//     simsPerParameterSet     = 100,
//     stepsPerParameterRange  = 10,
//     numberOfGamesRange      = { min: 3,     max: 50,        resolution: 1, },
//     numberOfPlayersRange    = { min: 100,   max: 100_000,   resolution: 1000, },
//     playerEngagementRange   = { min: .1,    max: 1,         resolution: .1, },
//     scoreRandomnessRange    = { min: 0,     max: 1,         resolution: .1, },
// ) {
//     // O = |parameters| ^ stepsPerParameterRange * simsPerParameterSet ...I think 🤔
//     let raw = [];
//     for (i of range(simsPerParameterSet)) {
//         raw.push(simulate());
//     };
//     return {
//         raw,
//     };
// };

function simulate (
    numberOfGames,
    numberOfPlayers,
    randomnessRange,
    playerEngagementRange,
) {
    console.log(`Simulating ${numberOfPlayers} players playing ${numberOfGames} games...`)
    const players = range(numberOfPlayers).map(i => player(i, playerEngagementRange))
    const games = range(numberOfGames).map(i => game(i, randomnessRange));

    // Players randomly decide which games they will play
    // NOTE: this is probably slow AF
    for (const player of players) {
        const gameCount = Math.ceil(games.length * player.participation);
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

    console.log(
        'The players play the games',
        // scores,
    );

    // Calculate leaderboards, percentiles and podiums for all games
    const tabulatedScores = games.reduce((agg, game) => {
        agg[game.id] = tabulateGameScores(game.id, scores)
        return agg;
    }, {});

    // Give players normalized scores for all games
    const normalizedScores = games.reduce((agg, game) => {
        agg[game.id] = players.reduce((agg, player) => {
            agg[player.id] = calculateGameScoreComponent(
                tabulatedScores[game.id].percentiles[player.id],
                tabulatedScores[game.id].leaderboard.findIndex(score => score.player === player.id) + 1,
            );
            return agg;
        }, {});
        return agg;
    }, {});

    console.log(
        'Give players normalized scores for all games',
        // normalizedScores,
    );

    // Calculate leaderboard, percentiles and podium for overall metascores
    const metascores = tabulateMetascores(players, normalizedScores);
    
    console.log(
        'Calculate overall scores',
        metascores.podium,
        `${metascores.elite.length} elite ranked players,`,
        `${metascores.strong.length} strong ranked players,`,
        `${metascores.wooden.length} wooden ranked players,`,
        `${metascores.unranked.length} unranked players,`,
    );

    const participation = tabulateParticipation(players, games, metascores);

    console.log(
        'Tabulate participation',
        participation
    )

    const performance = tabulatePerformance(players, games, metascores, tabulatedScores)

    console.log(
        'Tabulate performance',
        performance
    )

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
    function getAveragePercentile (player) {
        return Object.keys(tabulatedScores).reduce((agg, game) => {
            agg += tabulatedScores[game].percentiles[player] || 0;
            return agg;
        }, 0) / players.find(x => x.id === player).games.length;
    };
    const rank1 = {
        ...tabulatePodiums(metascores.podium.first.player),
        averagePercentile: getAveragePercentile(metascores.podium.first.player),
    };
    const rank2 = {
        ...tabulatePodiums(metascores.podium.second.player),
        averagePercentile: getAveragePercentile(metascores.podium.second.player),
    };
    const rank3 = {
        ...tabulatePodiums(metascores.podium.third.player),
        averagePercentile: getAveragePercentile(metascores.podium.third.player),
    };
    return {
        rank1,
        rank2,
        rank3,
        // elite,
        // strong,
        // wooden,
        // podium,
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
    };
}

function tabulateGameScores (
    game,
    scores,
) {
    scores = scores.filter(score => score.game === game);
    const leaderboard = scores.sort((a, b) => b.score - a.score);
    const percentiles = scores.reduce((agg, score, i) => {
        agg[score.player] = 1 - (i / (leaderboard.length - 1));
        return agg;
    }, {});
    const podium = {
        first: leaderboard[0],
        second: leaderboard[1],
        third: leaderboard[2],
    };
    return {
        leaderboard,
        percentiles,
        podium,
    };
};

function tabulateMetascores (
    players,
    normalizedScores,
    config=defaultRankingConfig,
) {
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
            score: scores[player.id]
        });
        return agg;
    }, []);
    const percentiles = leaderboard.reduce((agg, x, i) => {
        agg[x.player] = 1 - i / (players.length - 1)
        return agg;
    }, {});
    const podium = {
        first: leaderboard[0],
        second: leaderboard[1],
        third: leaderboard[2],
    };
    const unranked = players.filter(player => {
        return scores[player.id] < config.tier1ScoreThreshold;
    });
    const wooden = players.filter(player => {
        return scores[player.id] >= config.tier1ScoreThreshold
            && percentiles[player.id] <= config.tier2Percentile;
    });
    const strong = players.filter(player => {
        return percentiles[player.id] > config.tier2Percentile
            && percentiles[player.id] <= config.tier3Percentile;
    });
    const elite = players.filter(player => {
        return percentiles[player.id] > config.tier3Percentile
            && leaderboard.findIndex(x => x.player === player.id) > 2;
    });
    return {
        scores,
        leaderboard,
        percentiles,
        podium,
        unranked,
        wooden,
        strong,
        elite,
    };
};

// Mock metascore functions

function calculateGameScoreComponent (
    percentile,
    rank,
    {
        max,
        participationPortion,
        performancePortion,
        podiumPortion,
        secondPlaceDenominator,
        thirdPlaceDenominator,
    } = defaultScoringConfig,
) {
    if (
        participationPortion
        + performancePortion
        + podiumPortion
        !== 1
    ) throw new Error('Scoring portions must sum to 1.');
    if (
        percentile === undefined ||
        rank === undefined
    ) return 0;
    let score = max * participationPortion;
    score += max * performancePortion * percentile;
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
    return 
};

function range (n) {
    return Array.from(Array(n).keys());
};

function rangeDelta ({min, max}) {
    return max - min;
};