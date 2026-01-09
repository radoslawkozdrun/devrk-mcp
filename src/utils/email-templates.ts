/**
 * Email Templates
 *
 * HTML email templates embedded as strings.
 * Placeholders ({{VARIABLE}}) are replaced at runtime by email-formatter.
 */

/**
 * Video digest email template
 *
 * Placeholders:
 * - {{TOTAL_VIDEOS}} - Total number of videos
 * - {{TOTAL_CHANNELS}} - Total number of channels
 * - {{DATE}} - Current date (formatted)
 * - {{CHANNELS_CONTENT}} - Generated HTML for channels and videos
 */
export const videoDigestTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #ff0000;
            margin-bottom: 10px;
        }
        .summary {
            background-color: #f0f0f0;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 30px;
        }
        .channel {
            margin-bottom: 30px;
            border-left: 4px solid #ff0000;
            padding-left: 15px;
        }
        .channel-name {
            font-size: 1.2em;
            font-weight: bold;
            color: #ff0000;
            margin-bottom: 10px;
        }
        .video {
            margin-bottom: 15px;
            padding: 10px;
            background-color: #fafafa;
            border-radius: 5px;
        }
        .video-title {
            font-weight: bold;
            color: #333;
            text-decoration: none;
        }
        .video-title:hover {
            color: #ff0000;
        }
        .video-date {
            color: #666;
            font-size: 0.9em;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📺 Nowe filmy YouTube</h1>
        <div class="summary">
            <strong>Podsumowanie:</strong> Znaleziono {{TOTAL_VIDEOS}} filmów z {{TOTAL_CHANNELS}} kanałów<br>
            <strong>Data:</strong> {{DATE}}
        </div>
        {{CHANNELS_CONTENT}}
        <div class="footer">
            Automatyczne powiadomienie z serwera MCP YouTube
        </div>
    </div>
</body>
</html>`;
