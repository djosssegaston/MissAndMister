<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vote extends Model
{
    /** @use HasFactory<\Database\Factories\VoteFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'candidate_id',
        'payment_id',
        'amount',
        'quantity',
        'currency',
        'status',
        'ip_address',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'quantity' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }
}
