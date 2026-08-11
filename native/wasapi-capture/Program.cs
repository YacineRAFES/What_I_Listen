using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace WhatIListenWasapi
{
    internal static class Program
    {
        private static int Main(string[] arguments)
        {
            try
            {
                if (arguments.Length == 1 && arguments[0] == "list")
                {
                    ListDevices();
                    return 0;
                }

                if (arguments.Length >= 1 && arguments[0] == "capture")
                {
                    Capture(arguments.Length > 1 ? arguments[1] : String.Empty);
                    return 0;
                }

                throw new ArgumentException("Utilisation : wasapi-capture.exe list | capture [id-peripherique]");
            }
            catch (Exception error)
            {
                WriteError(error.Message);
                return 1;
            }
        }

        private static void ListDevices()
        {
            using (var enumerator = new MMDeviceEnumerator())
            {
                string defaultId = String.Empty;
                try
                {
                    defaultId = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia).ID;
                }
                catch (COMException)
                {
                    // Windows peut ne pas avoir de sortie active. La liste reste utile.
                }

                var entries = new List<string>();
                foreach (MMDevice device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
                {
                    entries.Add("{\"id\":\"" + Escape(device.ID) + "\",\"name\":\"" + Escape(device.FriendlyName)
                        + "\",\"isDefault\":" + (device.ID == defaultId ? "true" : "false") + "}");
                }
                Console.WriteLine("{\"type\":\"devices\",\"defaultId\":\"" + Escape(defaultId)
                    + "\",\"devices\":[" + String.Join(",", entries) + "]}");
            }
        }

        private static void Capture(string deviceId)
        {
            using (var enumerator = new MMDeviceEnumerator())
            using (var device = String.IsNullOrEmpty(deviceId)
                ? enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia)
                : enumerator.GetDevice(deviceId))
            using (var capture = new WasapiLoopbackCapture(device))
            {
                var analyzer = new SpectrumAnalyzer(capture.WaveFormat.SampleRate);
                capture.DataAvailable += delegate(object sender, WaveInEventArgs args)
                {
                    analyzer.Process(args.Buffer, args.BytesRecorded, capture.WaveFormat);
                };
                capture.RecordingStopped += delegate(object sender, StoppedEventArgs args)
                {
                    if (args.Exception != null) WriteError(args.Exception.Message);
                    Environment.Exit(args.Exception == null ? 0 : 1);
                };
                capture.StartRecording();
                Thread.Sleep(Timeout.Infinite);
            }
        }

        private static void WriteError(string message)
        {
            Console.WriteLine("{\"type\":\"error\",\"message\":\"" + Escape(message) + "\"}");
        }

        private static string Escape(string value)
        {
            if (String.IsNullOrEmpty(value)) return String.Empty;
            var escaped = new StringBuilder(value.Length + 16);
            foreach (char character in value)
            {
                switch (character)
                {
                    case '\\': escaped.Append("\\\\"); break;
                    case '"': escaped.Append("\\\""); break;
                    case '\r': escaped.Append("\\r"); break;
                    case '\n': escaped.Append("\\n"); break;
                    case '\t': escaped.Append("\\t"); break;
                    default:
                        if (character < 32) escaped.AppendFormat("\\u{0:x4}", (int)character);
                        else escaped.Append(character);
                        break;
                }
            }
            return escaped.ToString();
        }
    }

    internal sealed class SpectrumAnalyzer
    {
        private const int BandCount = 16;
        private const int FftSize = 2048;
        private static readonly long UpdateIntervalTicks = 33L * Stopwatch.Frequency / 1000L;

        private readonly float[] samples = new float[FftSize];
        private readonly object sync = new object();
        private readonly int sampleRate;
        private int sampleCount;
        private int writePosition;
        private long lastUpdate;

        internal SpectrumAnalyzer(int sampleRate)
        {
            this.sampleRate = sampleRate;
        }

        internal void Process(byte[] buffer, int byteCount, WaveFormat format)
        {
            int blockAlign = format.BlockAlign;
            if (blockAlign <= 0 || format.Channels <= 0) return;

            int bytesPerSample = Math.Max(1, format.BitsPerSample / 8);
            int frameCount = byteCount / blockAlign;
            lock (sync)
            {
                for (int frame = 0; frame < frameCount; frame++)
                {
                    int frameOffset = frame * blockAlign;
                    double combined = 0;
                    for (int channel = 0; channel < format.Channels; channel++)
                    {
                        combined += ReadSample(buffer, frameOffset + channel * bytesPerSample, bytesPerSample, format.Encoding);
                    }
                    samples[writePosition] = (float)(combined / format.Channels);
                    writePosition = (writePosition + 1) % FftSize;
                    sampleCount = Math.Min(FftSize, sampleCount + 1);
                }

                long now = Stopwatch.GetTimestamp();
                if (sampleCount == FftSize && now - lastUpdate >= UpdateIntervalTicks)
                {
                    lastUpdate = now;
                    Publish();
                }
            }
        }

        private static double ReadSample(byte[] buffer, int offset, int bytesPerSample, WaveFormatEncoding encoding)
        {
            if (offset < 0 || offset + bytesPerSample > buffer.Length) return 0;
            if (encoding == WaveFormatEncoding.IeeeFloat && bytesPerSample == 4)
            {
                return BitConverter.ToSingle(buffer, offset);
            }
            if (bytesPerSample == 2) return BitConverter.ToInt16(buffer, offset) / 32768.0;
            if (bytesPerSample == 3)
            {
                int value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
                if ((value & 0x800000) != 0) value |= unchecked((int)0xff000000);
                return value / 8388608.0;
            }
            if (bytesPerSample == 4) return BitConverter.ToInt32(buffer, offset) / 2147483648.0;
            return 0;
        }

        private void Publish()
        {
            var real = new double[FftSize];
            var imaginary = new double[FftSize];
            for (int index = 0; index < FftSize; index++)
            {
                int sampleIndex = (writePosition + index) % FftSize;
                double window = 0.5d - 0.5d * Math.Cos(2d * Math.PI * index / (FftSize - 1));
                real[index] = samples[sampleIndex] * window;
            }
            Transform(real, imaginary);

            var bands = new double[BandCount];
            int minimumBin = Math.Max(1, (int)Math.Floor(35d * FftSize / sampleRate));
            int maximumBin = FftSize / 2 - 1;
            for (int band = 0; band < BandCount; band++)
            {
                double startRatio = band / (double)BandCount;
                double endRatio = (band + 1) / (double)BandCount;
                int start = Math.Max(minimumBin, (int)Math.Floor(minimumBin * Math.Pow(maximumBin / (double)minimumBin, startRatio)));
                int end = Math.Min(maximumBin, Math.Max(start + 1, (int)Math.Floor(minimumBin * Math.Pow(maximumBin / (double)minimumBin, endRatio))));
                double total = 0;
                for (int bin = start; bin <= end; bin++)
                {
                    double magnitude = Math.Sqrt(real[bin] * real[bin] + imaginary[bin] * imaginary[bin]) / FftSize;
                    total += magnitude;
                }
                double average = total / (end - start + 1);
                double decibels = 20d * Math.Log10(Math.Max(average, 0.00000001d));
                double normalized = Math.Min(1d, Math.Max(0d, (decibels + 72d) / 60d));
                bands[band] = Math.Pow(normalized, 0.72d);
            }

            double level = 0;
            var serializedBands = new string[BandCount];
            for (int index = 0; index < BandCount; index++)
            {
                level += bands[index];
                serializedBands[index] = bands[index].ToString("0.0000", CultureInfo.InvariantCulture);
            }
            level /= BandCount;
            Console.WriteLine("{\"type\":\"levels\",\"bands\":[" + String.Join(",", serializedBands)
                + "],\"level\":" + level.ToString("0.0000", CultureInfo.InvariantCulture) + "}");
        }

        private static void Transform(double[] real, double[] imaginary)
        {
            int count = real.Length;
            for (int index = 1, reversed = 0; index < count; index++)
            {
                int bit = count >> 1;
                for (; (reversed & bit) != 0; bit >>= 1) reversed ^= bit;
                reversed ^= bit;
                if (index >= reversed) continue;
                double temporaryReal = real[index];
                real[index] = real[reversed];
                real[reversed] = temporaryReal;
                double temporaryImaginary = imaginary[index];
                imaginary[index] = imaginary[reversed];
                imaginary[reversed] = temporaryImaginary;
            }

            for (int length = 2; length <= count; length <<= 1)
            {
                double angle = -2d * Math.PI / length;
                double phaseStepReal = Math.Cos(angle);
                double phaseStepImaginary = Math.Sin(angle);
                for (int start = 0; start < count; start += length)
                {
                    double phaseReal = 1;
                    double phaseImaginary = 0;
                    int halfLength = length >> 1;
                    for (int offset = 0; offset < halfLength; offset++)
                    {
                        int even = start + offset;
                        int odd = even + halfLength;
                        double oddReal = real[odd] * phaseReal - imaginary[odd] * phaseImaginary;
                        double oddImaginary = real[odd] * phaseImaginary + imaginary[odd] * phaseReal;
                        real[odd] = real[even] - oddReal;
                        imaginary[odd] = imaginary[even] - oddImaginary;
                        real[even] += oddReal;
                        imaginary[even] += oddImaginary;
                        double nextPhaseReal = phaseReal * phaseStepReal - phaseImaginary * phaseStepImaginary;
                        phaseImaginary = phaseReal * phaseStepImaginary + phaseImaginary * phaseStepReal;
                        phaseReal = nextPhaseReal;
                    }
                }
            }
        }
    }
}
