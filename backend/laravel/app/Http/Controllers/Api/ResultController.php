<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Result;
use App\Services\ResultService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ResultController extends Controller
{
    public function __construct(private ResultService $results)
    {
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        return response()->json(
            Result::with(['candidate.category', 'category'])
                ->orderByRaw('CASE WHEN category_id IS NULL THEN 1 ELSE 0 END')
                ->orderBy('category_id')
                ->orderByDesc('total_votes')
                ->get()
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(): JsonResponse
    {
        $this->authorize('create', Result::class);
        $this->results->calculateAndPersist();
        return response()->json(['message' => 'Results calculated']);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    public function export(): StreamedResponse
    {
        $this->authorize('viewAny', Result::class);

        $rows = Result::with(['candidate.category', 'category'])
            ->orderByRaw('CASE WHEN category_id IS NULL THEN 1 ELSE 0 END')
            ->orderBy('category_id')
            ->orderByDesc('total_votes')
            ->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="results.csv"',
        ];

        $callback = function () use ($rows) {
            $output = fopen('php://output', 'w');
            fputcsv($output, ['Categorie', 'Candidate', 'Total Votes', 'Total Amount']);
            foreach ($rows as $row) {
                fputcsv($output, [
                    $row->category?->name ?? $row->candidate?->category?->name,
                    optional($row->candidate)->first_name . ' ' . optional($row->candidate)->last_name,
                    $row->total_votes,
                    $row->total_amount,
                ]);
            }
            fclose($output);
        };

        return response()->stream($callback, 200, $headers);
    }
}
