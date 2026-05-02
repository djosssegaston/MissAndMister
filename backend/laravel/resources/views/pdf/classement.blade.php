<!DOCTYPE html>
<html lang="fr">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Classement {{ $categoryName }} - Miss & Mister University Benin</title>
    <style>
        @page {
            margin: 115px 38px 120px 38px;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            color: #141414;
            font-family: DejaVu Sans, sans-serif;
            font-size: 12px;
            line-height: 1.45;
        }

        header {
            position: fixed;
            top: -92px;
            left: 0;
            right: 0;
            height: 82px;
            border-bottom: 1.5px solid #caa85d;
            padding-bottom: 10px;
        }

        .header-inner {
            width: 100%;
            display: table;
        }

        .header-logo,
        .header-copy {
            display: table-cell;
            vertical-align: middle;
        }

        .header-logo {
            width: 86px;
        }

        .header-logo img {
            width: 66px;
            height: 66px;
            object-fit: contain;
        }

        .header-copy {
            text-align: center;
            padding-right: 56px;
        }

        .header-title {
            margin: 0;
            font-size: 19px;
            font-weight: 700;
            letter-spacing: 0.9px;
            text-transform: uppercase;
            color: #181818;
        }

        .header-edition {
            margin: 4px 0 0;
            font-size: 11px;
            font-weight: 700;
            color: #9d7a28;
        }

        .header-subtitle {
            margin: 4px 0 0;
            font-size: 11px;
            color: #444;
        }

        footer {
            position: fixed;
            bottom: -96px;
            left: 0;
            right: 0;
            height: 88px;
            border-top: 1px solid #cfcfcf;
            color: #383838;
            font-size: 10px;
            text-align: center;
            padding-top: 10px;
        }

        .footer-copy {
            margin-top: 6px;
            letter-spacing: 0.2px;
        }

        .page-counter::after {
            content: "Page " counter(page);
        }

        .section-kicker {
            margin: 0 0 12px;
            padding: 7px 10px;
            border: 1px solid #d8c090;
            background: #f7f2e7;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #7e6222;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
        }

        thead th {
            background: #e9e3d5;
            color: #1b1b1b;
            border: 1px solid #cfc6b2;
            padding: 9px 8px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.45px;
            text-align: left;
        }

        tbody td {
            border: 1px solid #d7d7d7;
            padding: 8px 8px;
            vertical-align: top;
        }

        tbody tr:nth-child(even) {
            background: #f6f6f6;
        }

        .col-name { width: 34%; }
        .col-university { width: 28%; }
        .col-votes { width: 12%; text-align: center; }
        .col-percentage { width: 16%; text-align: center; }
        .col-rank { width: 10%; text-align: center; }

        .name-cell {
            font-weight: 700;
            color: #151515;
        }

        .rank-badge {
            display: inline-block;
            min-width: 28px;
            padding: 3px 8px;
            border: 1px solid #b08933;
            border-radius: 999px;
            background: #f5ecd8;
            color: #7b5d1b;
            font-weight: 700;
        }

        .signature-wrap {
            margin-top: 18px;
            width: 100%;
            display: table;
        }

        .signature-spacer,
        .signature-block {
            display: table-cell;
            vertical-align: top;
        }

        .signature-spacer {
            width: 52%;
        }

        .signature-block {
            width: 48%;
            padding-left: 22px;
        }

        .signature-title {
            margin: 0 0 8px;
            font-size: 11px;
            color: #585858;
        }

        .signature-name {
            margin: 0 0 14px;
            font-size: 12px;
            font-weight: 700;
            color: #191919;
        }

        .signature-line {
            height: 1px;
            background: #1a1a1a;
            margin-bottom: 14px;
        }

        .stamp-box {
            height: 72px;
            border: 1px dashed #9d9d9d;
            border-radius: 8px;
            text-align: center;
            padding-top: 26px;
            color: #777;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
    </style>
</head>
<body>
    <header>
        <div class="header-inner">
            <div class="header-logo">
                @if($logoDataUri)
                    <img src="{{ $logoDataUri }}" alt="Logo Miss & Mister University Benin">
                @endif
            </div>
            <div class="header-copy">
                <p class="header-title">MISS &amp; MISTER UNIVERSITY BENIN</p>
                <p class="header-edition">{{ $editionLabel }}</p>
                <p class="header-subtitle">{{ $subtitle }}</p>
            </div>
        </div>
    </header>

    <footer>
        <div class="footer-copy">Concours Miss &amp; Mister University Bénin {{ $editionLabel }}</div>
        <div class="footer-copy page-counter"></div>
    </footer>

    <main>
        <div class="section-kicker">Classement {{ $categoryName }}</div>

        <table>
            <thead>
                <tr>
                    <th class="col-name">Nom prenom</th>
                    <th class="col-university">Université</th>
                    <th class="col-votes">Votes</th>
                    <th class="col-percentage">Pourcentage (/40%)</th>
                    <th class="col-rank">Rang</th>
                </tr>
            </thead>
            <tbody>
                @forelse($rows as $row)
                    <tr>
                        <td class="col-name name-cell">{{ $row['full_name'] }}</td>
                        <td class="col-university">{{ $row['university'] }}</td>
                        <td class="col-votes">{{ number_format($row['votes'], 0, ',', ' ') }}</td>
                        <td class="col-percentage">{{ number_format($row['percentage'], 2, ',', ' ') }}</td>
                        <td class="col-rank"><span class="rank-badge">{{ $row['rank'] }}</span></td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" style="text-align: center; color: #666;">Aucune donnée de classement disponible pour cette catégorie.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <div class="signature-wrap">
            <div class="signature-spacer"></div>
            <div class="signature-block">
                <p class="signature-title">Promoteur :</p>
                <p class="signature-name">{{ $signatory }}</p>
                <div class="signature-line"></div>
                <div class="stamp-box">Espace cachet</div>
            </div>
        </div>
    </main>
</body>
</html>
