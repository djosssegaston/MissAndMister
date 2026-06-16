<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SocialProject extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'candidate1_id',
        'candidate2_id',
        'theme',
        'created_by',
    ];

    public function candidate1()
    {
        return $this->belongsTo(Candidate::class, 'candidate1_id');
    }

    public function candidate2()
    {
        return $this->belongsTo(Candidate::class, 'candidate2_id');
    }

    public function creator()
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }
}
