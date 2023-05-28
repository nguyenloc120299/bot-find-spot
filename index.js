const ccxt = require('ccxt');
const TelegramBot = require('node-telegram-bot-api')
// Khởi tạo đối tượng sàn Binance
const exchange = new ccxt.binance();

// Khung thời gian
const timeframe = '4h'; // 4 giờ
const chat_id = "5145167023"
const bot = new TelegramBot("6170615780:AAEPHlWc-CB-hYA7JulFSrs1nquxLoSwEDs", { polling: true });

async function findEntryPoints() {
    try {

        // Lấy danh sách tất cả các cặp coin spot trên Binance
        const markets = await exchange.fetchMarkets();
        const spotMarkets = markets.filter(market => market.info.isSpotTradingAllowed && market.quote === 'USDT');

        // Lặp qua từng cặp coin
        for (const market of spotMarkets) {
            const symbol = market.symbol;

            // Lấy dữ liệu lịch sử giá
            const ohlcv = await exchange.fetchOHLCV(symbol, timeframe);

            // Chuyển đổi dữ liệu lịch sử thành mảng các đối tượng
            const candles = ohlcv.map(c => ({
                time: new Date(c[0]),
                open: c[1],
                high: c[2],
                low: c[3],
                close: c[4],
                volume: c[5]
            }));

            // Tính toán chỉ báo RSI
            const rsiPeriod = 14;
            const rsiValues = calculateRSI(candles, rsiPeriod);

            // Tính toán chỉ báo MACD
            const macdValues = calculateMACD(candles);

            // Tính toán đường trung bình mũ (EMA)
            const emaPeriod = 50;
            const emaValues = calculateEMA(candles, emaPeriod);

            // Xác định điểm nhập vào (entry point)
            const lastCandle = candles[candles.length - 1];
            const lastRSI = rsiValues[rsiValues.length - 1];
            const lastMACD = macdValues.macd[macdValues.macd.length - 1];
            const lastSignal = macdValues.signal[macdValues.signal.length - 1];
            const lastHistogram = macdValues.histogram[macdValues.histogram.length - 1];
            const lastEMA = emaValues[emaValues.length - 1];

            // Kiểm tra các điều kiện để đưa ra quyết định mua
            if (lastRSI < 30 && lastMACD > lastSignal && lastHistogram > 0 && lastCandle.close > lastEMA) {
                const entryPrice = lastCandle.close;
                const stopLossPrice = entryPrice * 0.9;
                const takeProfitPrice = entryPrice * 1.1;

                bot.sendMessage(chat_id, `Điểm nhập vào (entry point) tại thời điểm ${lastCandle.time}:
                Mua ${symbol}
                Entry: ${entryPrice}
                Stop Loss: ${stopLossPrice}
                Take Profit: ${takeProfitPrice}`);
            }
        }
    } catch (error) {
        console.error('Đã xảy ra lỗi:', error);
    }
}

// Tính toán chỉ báo RSI
function calculateRSI(candles, period) {
    const closes = candles.map(candle => candle.close);
    const changes = [];

    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }

    const gains = changes.filter(change => change > 0);
    const losses = changes.filter(change => change < 0).map(Math.abs);

    const averageGain = calculateAverage(gains, period);
    const averageLoss = calculateAverage(losses, period);

    const rs = averageGain.map((avgGain, i) => avgGain / averageLoss[i]);
    const rsi = rs.map(rs => 100 - (100 / (1 + rs)));

    return rsi;
}

// Tính toán chỉ báo MACD
function calculateMACD(candles) {
    const closes = candles.map(candle => candle.close);

    const macd12 = calculateEMA(closes, 12);
    const macd26 = calculateEMA(closes, 26);

    const macd = macd12.map((ema12, i) => ema12 - macd26[i]);

    const signal = calculateEMA(macd, 9);

    const histogram = macd.map((macdValue, i) => macdValue - signal[i]);

    return {
        macd,
        signal,
        histogram
    };
}

// Tính toán đường trung bình mũ (EMA)
function calculateEMA(values, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);

    ema[0] = values[0];

    for (let i = 1; i < values.length; i++) {
        ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
}

// Tính toán trung bình đơn giản (SMA)
function calculateAverage(values, period) {
    const averages = [];

    for (let i = period - 1; i < values.length; i++) {
        const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        const average = sum / period;
        averages.push(average);
    }

    return averages;
}

// Gọi hàm để tìm điểm nhập vào (entry point)
findEntryPoints();
setInterval(findEntryPoints, 60000 * 15)