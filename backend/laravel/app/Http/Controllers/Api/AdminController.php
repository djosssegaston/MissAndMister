<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;

class AdminController extends Controller
{
    public function activity(): JsonResponse
    {
        $this->authorize('viewAny', ActivityLog::class);
        return response()->json(ActivityLog::latest()->paginate(50));
    }
}
