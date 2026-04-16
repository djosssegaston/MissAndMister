<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        return response()->json(Category::orderBy('position')->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store()
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $data = Validator::make(request()->all(), [
            'name' => ['required', 'string', 'max:120', 'unique:categories,name'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,inactive'],
            'position' => ['nullable', 'integer'],
        ])->validate();

        $data['slug'] = Str::slug($data['name']);

        $category = Category::create($data);

        return response()->json($category, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Category $category): JsonResponse
    {
        return response()->json($category);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Category $category)
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $data = Validator::make(request()->all(), [
            'name' => ['sometimes', 'string', 'max:120', 'unique:categories,name,' . $category->id],
            'description' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'in:active,inactive'],
            'position' => ['sometimes', 'integer'],
        ])->validate();

        if (isset($data['name'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        $category->update($data);

        return response()->json($category);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Category $category): JsonResponse
    {
        abort_unless((request()->user()?->role ?? null) === 'superadmin', 403);
        $category->delete();
        return response()->json(['message' => 'Category deleted']);
    }
}
